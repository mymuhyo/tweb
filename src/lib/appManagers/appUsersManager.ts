/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 *
 * Originally from:
 * https://github.com/zhukov/webogram
 * Copyright (C) 2014 Igor Zhukov <igor.beatle@gmail.com>
 * https://github.com/zhukov/webogram/blob/master/LICENSE
 */

import filterUnique from '../../helpers/array/filterUnique';
import indexOfAndSplice from '../../helpers/array/indexOfAndSplice';
import deferredPromise, {CancellablePromise} from '../../helpers/cancellablePromise';
import cleanSearchText from '../../helpers/cleanSearchText';
import cleanUsername from '../../helpers/cleanUsername';
import tsNow from '../../helpers/tsNow';
import isObject from '../../helpers/object/isObject';
import safeReplaceObject from '../../helpers/object/safeReplaceObject';
import {isRestricted} from '../../helpers/restrictions';
import {Chat, ContactsResolvedPeer, InputContact, InputGeoPoint, InputMedia, InputPeer, InputUser, User as MTUser, UserProfilePhoto, UserStatus} from '../../layer';
import parseEntities from '../richTextProcessor/parseEntities';
import wrapUrl from '../richTextProcessor/wrapUrl';
import SearchIndex from '../searchIndex';
import {AppManager} from './manager';
import getPeerId from './utils/peers/getPeerId';
import canSendToUser from './utils/users/canSendToUser';
import {AppStoragesManager} from './appStoragesManager';
import deepEqual from '../../helpers/object/deepEqual';
import getPeerActiveUsernames from './utils/peers/getPeerActiveUsernames';
import callbackify from '../../helpers/callbackify';

export type User = MTUser.user;
export type TopPeerType = 'correspondents' | 'bots_inline';
export type MyTopPeer = {id: PeerId, rating: number};

export class AppUsersManager extends AppManager {
  private storage: AppStoragesManager['storages']['users'];

  private users: {[userId: UserId]: User};
  private usernames: {[username: string]: PeerId};
  private contactsIndex: SearchIndex<UserId>;
  private contactsFillPromise: CancellablePromise<AppUsersManager['contactsList']>;
  private contactsList: Set<UserId>;
  private updatedContactsList: boolean;

  private getTopPeersPromises: {[type in TopPeerType]?: Promise<MyTopPeer[]>};

  protected after() {
    this.clear(true);

    setInterval(this.updateUsersStatuses, 60000);

    this.rootScope.addEventListener('state_synchronized', this.updateUsersStatuses);

    this.apiUpdatesManager.addMultipleEventsListeners({
      updateUserStatus: (update) => {
        const userId = update.user_id;
        const user = this.users[userId];
        if(user) {
          user.status = update.status;
          if(user.status) {
            if('expires' in user.status) {
              user.status.expires -= this.timeManager.getServerTimeOffset();
            }

            if('was_online' in user.status) {
              user.status.was_online -= this.timeManager.getServerTimeOffset();
            }
          }

          // user.sortStatus = this.getUserStatusForSort(user.status);
          this.rootScope.dispatchEvent('user_update', userId);
          this.setUserToStateIfNeeded(user);
        } // ////else console.warn('No user by id:', userId);
      },

      // updateUserPhoto: (update) => {
      //   const userId = update.user_id;
      //   const user = this.users[userId];
      //   if(user) {
      //     if((user.photo as UserProfilePhoto.userProfilePhoto)?.photo_id === (update.photo as UserProfilePhoto.userProfilePhoto)?.photo_id) {
      //       return;
      //     }

      //     this.forceUserOnline(userId, update.date);

      //     if(update.photo._ === 'userProfilePhotoEmpty') {
      //       delete user.photo;
      //     } else {
      //       user.photo = safeReplaceObject(user.photo, update.photo);
      //     }

      //     this.setUserToStateIfNeeded(user);

      //     this.rootScope.dispatchEvent('user_update', userId);
      //     this.rootScope.dispatchEvent('avatar_update', userId.toPeerId());
      //   } else console.warn('No user by id:', userId);
      // },

      updateUserName: (update) => {
        const userId = update.user_id;
        const user = this.users[userId];
        if(user) {
          this.forceUserOnline(userId);

          this.saveApiUser({
            ...user,
            first_name: update.first_name,
            last_name: update.last_name,
            username: undefined,
            usernames: update.usernames
          }, true);
        }
      }
    });

    /* case 'updateContactLink':
    this.onContactUpdated(update.user_id, update.my_link._ === 'contactLinkContact');
    break; */

    return Promise.all([
      this.appStateManager.getState(),
      this.appStoragesManager.loadStorage('users')
    ]).then(([state, {results: users, storage}]) => {
      this.storage = storage;

      this.saveApiUsers(users);
      for(let i = 0, length = users.length; i < length; ++i) {
        const user = users[i];
        if(!user) {
          continue;
        }

        if(state.contactsListCachedTime && (user.pFlags.contact || user.pFlags.mutual_contact)) {
          this.pushContact(user.id);

          if(!this.contactsFillPromise) {
            this.contactsFillPromise = deferredPromise();
            this.contactsFillPromise.resolve(this.contactsList);
          }
        }
      }

      // const contactsList = state.contactsList;
      // if(Array.isArray(contactsList)) {
      //   contactsList.forEach((userId) => {
      //     this.pushContact(userId);
      //   });

      //   if(contactsList.length) {
      //     this.contactsFillPromise = deferredPromise();
      //     this.contactsFillPromise.resolve(this.contactsList);
      //   }
      // }

      const recentSearch = state.recentSearch || [];
      for(let i = 0, length = recentSearch.length; i < length; ++i) {
        this.peersStorage.requestPeer(recentSearch[i], 'recentSearch');
      }

      this.peersStorage.addEventListener('peerNeeded', (peerId) => {
        if(!this.appPeersManager.isUser(peerId)) {
          return;
        }

        const userId = peerId.toUserId();
        if(!this.storage.getFromCache(userId)) {
          this.storage.set({
            [userId]: this.getUser(userId)
          });
        }
      });

      this.peersStorage.addEventListener('peerUnneeded', (peerId) => {
        if(!this.appPeersManager.isUser(peerId)) {
          return;
        }

        const userId = peerId.toUserId();
        if(this.storage.getFromCache(userId)) {
          this.storage.delete(userId);
        }
      });
    });
  }

  public clear = (init = false) => {
    if(!init) {
      for(const userId in this.users) {
        // const userId = +userId;
        if(!userId) continue;
        const peerId = userId.toPeerId();
        if(!this.peersStorage.isPeerNeeded(peerId)) {
          const user = this.users[userId];
          this.modifyUsernamesCache(user, false);

          this.storage.delete(userId);
          delete this.users[userId];
        }
      }
    } else {
      this.users = {};
      this.usernames = {};
    }

    this.getTopPeersPromises = {};
    this.contactsIndex = this.createSearchIndex();
    this.contactsFillPromise = undefined;
    this.contactsList = new Set();
    this.updatedContactsList = false;
  };

  public indexMyself() {
    const userId = this.getSelf().id;
    this.contactsIndex.indexObject(userId, this.getUserSearchText(userId));
  }

  public get userId() {
    return this.rootScope.myId.toUserId();
  }

  private onContactsModified(fromServer?: boolean) {
    // const contactsList = [...this.contactsList];
    // this.appStateManager.pushToState('contactsList', contactsList);

    if(fromServer) {
      this.appStateManager.pushToState('contactsListCachedTime', tsNow(true));
    }
  }

  public pushRecentSearch(peerId: PeerId) {
    return this.appStateManager.getState().then((state) => {
      const recentSearch = state.recentSearch || [];
      if(recentSearch[0] !== peerId) {
        indexOfAndSplice(recentSearch, peerId);
        recentSearch.unshift(peerId);
        if(recentSearch.length > 20) {
          recentSearch.length = 20;
        }

        this.appStateManager.pushToState('recentSearch', recentSearch);
        for(const peerId of recentSearch) {
          this.peersStorage.requestPeer(peerId, 'recentSearch');
        }
      }
    });
  }

  public clearRecentSearch() {
    return this.appStateManager.getState().then((state) => {
      const recentSearch = state.recentSearch || [];
      for(const peerId of recentSearch) {
        this.peersStorage.releasePeer(peerId, 'recentSearch');
      }

      recentSearch.length = 0;
      this.appStateManager.pushToState('recentSearch', recentSearch);
    });
  }

  public fillContacts() {
    if(this.contactsFillPromise && this.updatedContactsList) {
      return {
        cached: this.contactsFillPromise.isFulfilled,
        promise: this.contactsFillPromise
      };
    }

    this.updatedContactsList = true;

    const promise = deferredPromise<Set<UserId>>();
    this.apiManager.invokeApi('contacts.getContacts').then((result) => {
      if(result._ === 'contacts.contacts') {
        this.contactsList.clear();

        this.saveApiUsers(result.users);

        result.contacts.forEach((contact) => {
          this.pushContact(contact.user_id);
        });

        this.onContactsModified(true);

        this.contactsFillPromise = promise;
      }

      promise.resolve(this.contactsList);
    }, () => {
      this.updatedContactsList = false;
    });

    return {
      cached: this.contactsFillPromise?.isFulfilled,
      promise: this.contactsFillPromise ||= promise
    };
  }

  public resolveUsername(username: string): Promise<Chat | User> | Chat | User {
    if(username[0] === '@') {
      username = username.slice(1);
    }

    username = username.toLowerCase();
    const peerId = this.usernames[username];
    if(peerId) {
      return this.appPeersManager.getPeer(peerId);
    }

    return this.apiManager.invokeApiSingleProcess({
      method: 'contacts.resolveUsername',
      params: {username},
      processResult: (resolvedPeer) => this.processResolvedPeer(resolvedPeer)
    });
  }

  public resolveUserByUsername(username: string) {
    return callbackify(this.resolveUsername(username), (peer) => {
      return peer?._ === 'user' ? peer : undefined;
    });
  }

  private processResolvedPeer(resolvedPeer: ContactsResolvedPeer.contactsResolvedPeer) {
    this.saveApiUsers(resolvedPeer.users);
    this.appChatsManager.saveApiChats(resolvedPeer.chats);

    return this.appPeersManager.getPeer(getPeerId(resolvedPeer.peer)) as Chat | User;
  }

  public resolvePhone(phone: string) {
    return this.apiManager.invokeApi('contacts.resolvePhone', {phone}).then((resolvedPeer) => {
      return this.processResolvedPeer(resolvedPeer) as User;
    });
  }

  private pushContact(id: UserId) {
    this.contactsList.add(id);
    this.contactsIndex.indexObject(id, this.getUserSearchText(id));
    this.peersStorage.requestPeer(id.toPeerId(), 'contact');
  }

  private popContact(id: UserId) {
    this.contactsList.delete(id);
    this.contactsIndex.indexObject(id, ''); // delete search index
    this.peersStorage.releasePeer(id.toPeerId(), 'contact');
  }

  public getUserSearchText(id: UserId) {
    const user = this.users[id];
    if(!user) {
      return '';
    }

    const arr: string[] = [
      user.first_name,
      user.last_name,
      user.phone,
      ...getPeerActiveUsernames(user),
      // user.pFlags.self ? I18n.format('SavedMessages', true) : '',
      user.pFlags.self ? 'Saved Messages' : ''
    ];

    return arr.filter(Boolean).join(' ');
  }

  public getContacts(query?: string, includeSaved = false, sortBy: 'name' | 'online' | 'none' = 'name') {
    return this.fillContacts().promise.then((_contactsList) => {
      let contactsList = [..._contactsList];
      if(query) {
        const results = this.contactsIndex.search(query);
        const filteredContactsList = [...contactsList].filter((id) => results.has(id));

        contactsList = filteredContactsList;
      }

      if(sortBy === 'name') {
        contactsList.sort((userId1, userId2) => {
          const sortName1 = (this.users[userId1] || {}).sortName || '';
          const sortName2 = (this.users[userId2] || {}).sortName || '';
          return sortName1.localeCompare(sortName2);
        });
      } else if(sortBy === 'online') {
        contactsList.sort((userId1, userId2) => {
          const status1 = this.getUserStatusForSort(this.getUser(userId1).status);
          const status2 = this.getUserStatusForSort(this.getUser(userId2).status);
          return status2 - status1;
        });
      }

      const myUserId = this.userId;
      indexOfAndSplice(contactsList, myUserId);
      if(includeSaved) {
        if(this.testSelfSearch(query)) {
          contactsList.unshift(myUserId);
        }
      }

      return contactsList;
    });
  }

  public getContactsPeerIds(
    query?: Parameters<AppUsersManager['getContacts']>[0],
    includeSaved?: Parameters<AppUsersManager['getContacts']>[1],
    sortBy?: Parameters<AppUsersManager['getContacts']>[2],
    limit?: number
  ) {
    return this.getContacts(query, includeSaved, sortBy).then((userIds) => {
      const peerIds = userIds.map((userId) => userId.toPeerId(false));
      if(limit) {
        return peerIds.slice(0, limit);
      }

      return peerIds;
    });
  }

  public toggleBlock(peerId: PeerId, block: boolean) {
    return this.apiManager.invokeApiSingle(block ? 'contacts.block' : 'contacts.unblock', {
      id: this.appPeersManager.getInputPeerById(peerId)
    }).then((value) => {
      if(value) {
        this.apiUpdatesManager.processLocalUpdate({
          _: 'updatePeerBlocked',
          peer_id: this.appPeersManager.getOutputPeer(peerId),
          blocked: block
        });
      }

      return value;
    });
  }

  public testSelfSearch(query: string) {
    const user = this.getSelf();
    const index = this.createSearchIndex();
    index.indexObject(user.id, this.getUserSearchText(user.id));
    return index.search(query).has(user.id);
  }

  public createSearchIndex() {
    return new SearchIndex<UserId>({
      clearBadChars: true,
      ignoreCase: true,
      latinize: true,
      includeTag: true
    });
  }

  public saveApiUsers(apiUsers: MTUser[], override?: boolean) {
    if((apiUsers as any).saved) return;
    (apiUsers as any).saved = true;
    apiUsers.forEach((user) => this.saveApiUser(user, override));
  }

  public modifyUsernamesCache(peer: Parameters<typeof getPeerActiveUsernames>[0], save: boolean) {
    const usernames = getPeerActiveUsernames(peer);
    if(!usernames.length) {
      return;
    }

    const cleanedUsernames = usernames.map((username) => cleanUsername(username));
    if(save) {
      cleanedUsernames.forEach((searchUsername) => {
        this.usernames[searchUsername] = peer.id.toPeerId(peer._ !== 'user');
      });
    } else {
      cleanedUsernames.forEach((searchUsername) => {
        delete this.usernames[searchUsername];
      });
    }
  }

  public setUsernameToCache(peer: Parameters<typeof getPeerActiveUsernames>[0], oldPeer?: typeof peer) {
    if(
      !oldPeer ||
      (oldPeer as MTUser.user).username !== (peer as MTUser.user).username ||
      !deepEqual((oldPeer as MTUser.user).usernames, (peer as MTUser.user).usernames)
    ) {
      this.modifyUsernamesCache(oldPeer, false);
      this.modifyUsernamesCache(peer, true);

      return true;
    }

    return false;
  }

  public saveApiUser(user: MTUser, override?: boolean) {
    if(!user || user._ === 'userEmpty') return;

    const userId = user.id;
    const oldUser = this.users[userId];

    // ! commented block can affect performance !
    // if(oldUser && !override) {
    //   console.log('saveApiUser same');
    //   return;
    // }

    user.pFlags ??= {};

    if(user.pFlags.min && oldUser !== undefined) {
      return;
    }

    // * exclude from state
    // defineNotNumerableProperties(user, ['initials', 'num', 'rFirstName', 'rFullName', 'rPhone', 'sortName', 'sortStatus']);

    const changedUsername = this.setUsernameToCache(user, oldUser);

    if(!oldUser ||
      oldUser.sortName === undefined ||
      oldUser.first_name !== user.first_name ||
      oldUser.last_name !== user.last_name) {
      const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');

      user.sortName = user.pFlags.deleted ? '' : cleanSearchText(fullName, false);
    } else {
      user.sortName = oldUser.sortName;
    }

    if(user.status) {
      if((user.status as UserStatus.userStatusOnline).expires) {
        (user.status as UserStatus.userStatusOnline).expires -= this.timeManager.getServerTimeOffset();
      }

      if((user.status as UserStatus.userStatusOffline).was_online) {
        (user.status as UserStatus.userStatusOffline).was_online -= this.timeManager.getServerTimeOffset();
      }
    }

    if((user as User).photo?._ === 'userProfilePhotoEmpty') {
      delete (user as User).photo;
    }

    // user.sortStatus = user.pFlags.bot ? -1 : this.getUserStatusForSort(user.status);

    // if(!user.username && user.usernames) {
    //   user.username = user.usernames.find((username) => username.pFlags.active).username;
    // }

    if(oldUser === undefined) {
      this.users[userId] = user;
    } else {
      const changedTitle = user.first_name !== oldUser.first_name ||
        user.last_name !== oldUser.last_name ||
        changedUsername;

      const oldPhotoId = (oldUser.photo as UserProfilePhoto.userProfilePhoto)?.photo_id;
      const newPhotoId = (user.photo as UserProfilePhoto.userProfilePhoto)?.photo_id;
      const changedPhoto = oldPhotoId !== newPhotoId;

      const changedPremium = oldUser.pFlags.premium !== user.pFlags.premium;
      const changedAnyBadge = changedPremium ||
        oldUser.pFlags.verified !== user.pFlags.verified ||
        oldUser.pFlags.scam !== user.pFlags.scam ||
        oldUser.pFlags.fake !== user.pFlags.fake;

      /* if(user.pFlags.bot && user.bot_info_version !== oldUser.bot_info_version) {

      } */

      const wasContact = !!oldUser.pFlags.contact;
      const newContact = !!user.pFlags.contact;

      safeReplaceObject(oldUser, user);
      this.rootScope.dispatchEvent('user_update', userId);

      if(wasContact !== newContact) {
        this.onContactUpdated(userId, newContact, wasContact);
      }

      if(changedPhoto) {
        this.rootScope.dispatchEvent('avatar_update', {peerId: user.id.toPeerId()});
      }

      if(changedTitle || changedAnyBadge) {
        this.rootScope.dispatchEvent('peer_title_edit', {peerId: user.id.toPeerId()});
      }

      // whitelisted domains
      if(changedPremium) {
        this.rootScope.dispatchEvent('peer_bio_edit', user.id.toPeerId());
      }
    }

    this.checkPremium(user, oldUser);
    this.setUserToStateIfNeeded(user);
  }

  private checkPremium(user: User, oldUser: User) {
    if(user.pFlags.self) {
      const isPremium = !!user.pFlags.premium;
      if(this.rootScope.premium !== isPremium) {
        this.rootScope.dispatchEvent('premium_toggle_private', {isNew: !oldUser, isPremium});
      }
    }
  }

  private setUserToStateIfNeeded(user: User) {
    if(this.peersStorage.isPeerNeeded(user.id.toPeerId())) {
      this.storage.set({
        [user.id]: user
      });
    }
  }

  public isUserOnlineVisible(id: UserId) {
    return this.getUserStatusForSort(id) > 3;
  }

  public getUserStatusForSort(status: User['status'] | UserId) {
    if(typeof(status) !== 'object') {
      const user = this.getUser(status);
      status = user?.status;
    }

    if(status) {
      const expires = status._ === 'userStatusOnline' ? status.expires : (status._ === 'userStatusOffline' ? status.was_online : 0);
      if(expires) {
        return expires;
      }

      /* const timeNow = tsNow(true);
      switch(status._) {
        case 'userStatusRecently':
          return timeNow - 86400 * 3;
        case 'userStatusLastWeek':
          return timeNow - 86400 * 7;
        case 'userStatusLastMonth':
          return timeNow - 86400 * 30;
      } */
      switch(status._) {
        case 'userStatusRecently':
          return 3;
        case 'userStatusLastWeek':
          return 2;
        case 'userStatusLastMonth':
          return 1;
      }
    }

    return 0;
  }

  public getUser(id: User | UserId) {
    if(isObject<User>(id)) {
      return id;
    }

    return this.users[id];
  }

  public getUserStatus(id: UserId) {
    return this.isRegularUser(id) && !this.users[id].pFlags.self && this.users[id].status;
  }

  public async getUserPhone(id: UserId) {
    const user = this.getUser(id);
    if(!user?.phone) {
      return;
    }

    const appConfig = await this.apiManager.getAppConfig();
    return {
      phone: user.phone,
      isAnonymous: appConfig.fragment_prefixes.some((prefix) => user.phone.startsWith(prefix))
    };
  }

  public getSelf() {
    return this.getUser(this.userId);
  }

  public isBot(id: UserId) {
    return this.users[id] && !!this.users[id].pFlags.bot;
  }

  public isAttachMenuBot(id: UserId) {
    return this.isBot(id) && !!this.users[id].pFlags.bot_attach_menu;
  }

  public isContact(id: UserId) {
    return this.contactsList.has(id) || !!(this.users[id] && this.users[id].pFlags.contact);
  }

  public isRegularUser(id: UserId) {
    const user = this.users[id];
    return user && !this.isBot(id) && !user.pFlags.deleted && !user.pFlags.support;
  }

  public isNonContactUser(id: UserId) {
    return this.isRegularUser(id) && !this.isContact(id) && id !== this.userId;
  }

  public isPremium(id: UserId) {
    const user = this.users[id];
    return !!user?.pFlags?.premium;
  }

  public hasUser(id: UserId, allowMin?: boolean) {
    const user = this.users[id];
    return isObject(user) && (allowMin || !user.pFlags.min);
  }

  public canEdit(id: UserId) {
    return this.userId === id || this.isContact(id) || !!this.users[id]?.pFlags?.bot_can_edit;
  }

  public getUserString(id: UserId) {
    const user = this.getUser(id);
    return 'u' + id + (user.access_hash ? '_' + user.access_hash : '');
  }

  public getUserInput(id: UserId): InputUser {
    const user = this.getUser(id);
    if(user.pFlags && user.pFlags.self) {
      return {_: 'inputUserSelf'};
    }

    return {
      _: 'inputUser',
      user_id: id,
      access_hash: user.access_hash
    };
  }

  public getUserInputPeer(id: UserId): InputPeer.inputPeerSelf | InputPeer.inputPeerUser {
    const user = this.getUser(id);
    // ! do not use it, there are places that don't support it. need explicit peer id
    // if(user.pFlags?.self) {
    //   return {_: 'inputPeerSelf'};
    // }

    return {
      _: 'inputPeerUser',
      user_id: id,
      access_hash: user.access_hash
    };
  }

  public getContactMediaInput(id: UserId): InputMedia.inputMediaContact {
    const user = this.getUser(id);

    return {
      _: 'inputMediaContact',
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone,
      vcard: '',
      user_id: id
    };
  }

  private updateUsersStatuses = () => {
    const timestampNow = tsNow(true);
    for(const i in this.users) {
      const user = this.users[i];
      this.updateUserStatus(user, timestampNow);
    }
  };

  private updateUserStatus(user: MTUser.user, timestampNow = tsNow(true)) {
    if(user.status &&
      user.status._ === 'userStatusOnline' &&
      user.status.expires < timestampNow) {
      user.status = {_: 'userStatusOffline', was_online: user.status.expires};
      this.rootScope.dispatchEvent('user_update', user.id);

      this.setUserToStateIfNeeded(user);
    }
  }

  public forceUserOnline(id: UserId, eventTimestamp?: number) {
    if(this.isBot(id)) {
      return;
    }

    const timestamp = tsNow(true);
    const onlineTimeFor = 60;
    if(eventTimestamp) {
      if((timestamp - eventTimestamp) >= onlineTimeFor) {
        return;
      }
    } else if(this.apiUpdatesManager.updatesState.syncLoading) {
      return;
    }

    const user = this.getUser(id);
    if(user?.status &&
      user.status._ !== 'userStatusOnline' &&
      user.status._ !== 'userStatusEmpty' &&
      !user.pFlags.support &&
      !user.pFlags.deleted) {
      user.status = {
        _: 'userStatusOnline',
        expires: timestamp + onlineTimeFor
      };

      // user.sortStatus = this.getUserStatusForSort(user.status);
      this.rootScope.dispatchEvent('user_update', id);

      this.setUserToStateIfNeeded(user);
    }
  }

  public importContact(first_name: string, last_name: string, phone: string) {
    return this.importContacts([{
      first_name,
      last_name,
      phones: [phone]
    }]).then((userIds) => {
      if(!userIds.length) {
        const error = new Error();
        (error as any).type = 'NO_USER';
        throw error;
      }

      return userIds[0];
    });
  }

  public importContacts(contacts: {phones: string[], first_name: string, last_name: string}[]) {
    const inputContacts: InputContact[] = [];

    for(let i = 0; i < contacts.length; ++i) {
      for(let j = 0; j < contacts[i].phones.length; ++j) {
        inputContacts.push({
          _: 'inputPhoneContact',
          client_id: (i << 16 | j).toString(10),
          phone: contacts[i].phones[j],
          first_name: contacts[i].first_name,
          last_name: contacts[i].last_name
        });
      }
    }

    return this.apiManager.invokeApi('contacts.importContacts', {
      contacts: inputContacts
    }).then((importedContactsResult) => {
      this.saveApiUsers(importedContactsResult.users);

      const userIds = importedContactsResult.imported.map((importedContact) => {
        this.onContactUpdated(importedContact.user_id, true);
        return importedContact.user_id;
      });

      return userIds;
    });
  }

  public getTopPeers(type: TopPeerType) {
    if(this.getTopPeersPromises[type]) return this.getTopPeersPromises[type];

    return this.getTopPeersPromises[type] = this.appStateManager.getState().then((state) => {
      const cached = state.topPeersCache[type];
      if(cached && (cached.cachedTime + 86400e3) > Date.now() && cached.peers) {
        return cached.peers;
      }

      return this.apiManager.invokeApi('contacts.getTopPeers', {
        [type]: true,
        offset: 0,
        limit: 15,
        hash: '0'
      }).then((result) => {
        let topPeers: MyTopPeer[] = [];
        if(result._ === 'contacts.topPeers') {
          // console.log(result);
          this.saveApiUsers(result.users);
          this.appChatsManager.saveApiChats(result.chats);

          if(result.categories.length) {
            topPeers = result.categories[0].peers.map((topPeer) => {
              const peerId = getPeerId(topPeer.peer);
              this.peersStorage.requestPeer(peerId, 'topPeer');
              return {id: peerId, rating: topPeer.rating};
            });
          }
        }

        state.topPeersCache[type] = {
          peers: topPeers,
          cachedTime: Date.now()
        };
        this.appStateManager.pushToState('topPeersCache', state.topPeersCache);

        return topPeers;
      });
    });
  }

  public getBlocked(offset = 0, limit = 0) {
    return this.apiManager.invokeApiSingle('contacts.getBlocked', {offset, limit}).then((contactsBlocked) => {
      this.saveApiUsers(contactsBlocked.users);
      this.appChatsManager.saveApiChats(contactsBlocked.chats);
      const count = contactsBlocked._ === 'contacts.blocked' ? contactsBlocked.users.length + contactsBlocked.chats.length : contactsBlocked.count;

      const peerIds: PeerId[] = contactsBlocked.users.map((u) => u.id.toPeerId()).concat(contactsBlocked.chats.map((c) => c.id.toPeerId(true)));

      return {count, peerIds};
    });
  }

  public getLocated(
    lat: number,
    long: number,
    accuracy_radius: number,
    background: boolean = false,
    self_expires: number = 0
  ) {
    const geo_point: InputGeoPoint = {
      _: 'inputGeoPoint',
      lat,
      long,
      accuracy_radius
    };

    return this.apiManager.invokeApi('contacts.getLocated', {
      geo_point,
      background
    }).then((updates) => {
      this.apiUpdatesManager.processUpdateMessage(updates);
      return updates;
    });
  }

  /* public searchContacts(query: string, limit = 20) {
    return Promise.all([
      this.getContacts(query),
      apiManager.invokeApi('contacts.search', {
        q: query,
        limit
      })
    ]).then((results) => {
      const [myContacts, peers] = results;

      this.saveApiUsers(peers.users);
      appChatsManager.saveApiChats(peers.chats);

      // * contacts.search returns duplicates in my_results
      const myResults = new Set(myContacts.concat(peers.my_results.map((p) => appPeersManager.getPeerID(p))));

      const out = {
        my_results: [...myResults].slice(0, limit),
        results: peers.results.map((p) => appPeersManager.getPeerID(p))
      };

      return out;
    });
  } */
  public searchContacts(query: string, limit = 20) {
    // handle 't.me/username' as 'username'
    const entities = parseEntities(query);
    if(entities.length && entities[0].length === query.trim().length && entities[0]._ === 'messageEntityUrl') {
      try {
        const url = new URL(wrapUrl(query).url);
        const path = url.pathname.slice(1);
        if(path) {
          query = path;
        }
      } catch(err) {}
    }

    return this.apiManager.invokeApiCacheable('contacts.search', {
      q: query,
      limit
    }, {cacheSeconds: 60}).then((peers) => {
      this.saveApiUsers(peers.users);
      this.appChatsManager.saveApiChats(peers.chats);

      const out = {
        my_results: filterUnique(peers.my_results.map((p) => getPeerId(p))), // ! contacts.search returns duplicates in my_results
        results: peers.results.map((p) => getPeerId(p))
      };

      return out;
    });
  }

  private onContactUpdated(userId: UserId, isContact: boolean, curIsContact = this.isContact(userId)) {
    if(isContact !== curIsContact) {
      if(isContact) {
        this.pushContact(userId);
      } else {
        this.popContact(userId);
      }

      this.onContactsModified();

      this.rootScope.dispatchEvent('contacts_update', userId);
    }
  }

  public updateUsername(username: string) {
    return this.apiManager.invokeApi('account.updateUsername', {
      username
    }).then((user) => {
      this.saveApiUser(user);
    });
  }

  public setUserStatus(userId: UserId, offline: boolean) {
    if(this.isBot(userId)) {
      return;
    }

    const user = this.users[userId];
    if(user) {
      const status: UserStatus = offline ? {
        _: 'userStatusOffline',
        was_online: tsNow(true)
      } : {
        _: 'userStatusOnline',
        expires: tsNow(true) + 50
      };

      user.status = status;
      // user.sortStatus = this.getUserStatusForSort(user.status);
      this.rootScope.dispatchEvent('user_update', userId);

      this.setUserToStateIfNeeded(user);
    }
  }

  public updateMyOnlineStatus(offline: boolean) {
    this.setUserStatus(this.getSelf().id, offline);
    return this.apiManager.invokeApiSingle('account.updateStatus', {offline});
  }

  public addContact(userId: UserId, first_name: string, last_name: string, phone: string, addPhonePrivacyException?: boolean) {
    /* if(!userId) {
      return this.importContacts([{
        first_name,
        last_name,
        phones: [phone]
      }]);
    } */

    return this.apiManager.invokeApi('contacts.addContact', {
      id: this.getUserInput(userId),
      first_name,
      last_name,
      phone,
      add_phone_privacy_exception: addPhonePrivacyException
    }).then((updates) => {
      this.apiUpdatesManager.processUpdateMessage(updates, {override: true});

      this.onContactUpdated(userId, true);
    });
  }

  public deleteContacts(userIds: UserId[]) {
    return this.apiManager.invokeApi('contacts.deleteContacts', {
      id: userIds.map((userId) => this.getUserInput(userId))
    }).then((updates) => {
      this.apiUpdatesManager.processUpdateMessage(updates, {override: true});

      userIds.forEach((userId) => {
        this.onContactUpdated(userId, false);
      });
    });
  }

  public checkUsername(username: string) {
    return this.apiManager.invokeApi('account.checkUsername', {username});
  }

  public canSendToUser(userId: UserId) {
    return canSendToUser(this.getUser(userId));
  }

  public getCommonChats(userId: UserId, limit = 100, maxId?: ChatId) {
    return this.apiManager.invokeApiSingleProcess({
      method: 'messages.getCommonChats',
      params: {
        user_id: this.getUserInput(userId),
        limit,
        max_id: maxId ?? 0
      },
      processResult: (messagesChats) => {
        this.appChatsManager.saveApiChats(messagesChats.chats);
        return messagesChats;
      }
    });
  }
}
