/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import PopupElement from '.';
import type {PeerType} from '../../lib/appManagers/appPeersManager';
import {FormatterArguments, LangPackKey} from '../../lib/langPack';
import wrapPeerTitle from '../wrappers/peerTitle';
import PopupPeer, {PopupPeerButtonCallbackCheckboxes, PopupPeerOptions} from './peer';

export default class PopupDeleteDialog {
  constructor(
    private peerId: PeerId,
    // actionType: 'leave' | 'delete',
    private peerType?: PeerType,
    private onSelect?: (promise: Promise<any>) => void,
    private threadId?: number
  ) {
    this.construct();
  }

  private async construct() {
    let {peerId, peerType, onSelect, threadId} = this;
    const peerTitleElement = await wrapPeerTitle({peerId, threadId: threadId});

    const managers = PopupElement.MANAGERS;
    if(peerType === undefined) {
      peerType = await managers.appPeersManager.getDialogType(peerId);
    }

    /* const callbackFlush = (checked: PopupPeerButtonCallbackCheckboxes) => {
      const promise = appMessagesManager.flushHistory(peerId, checkboxes ? !checked[checkboxes[0].text] : undefined);
      onSelect && onSelect(promise);
    }; */

    const callbackLeave = (checked: PopupPeerButtonCallbackCheckboxes, flush = checkboxes && !!checked.size) => {
      let promise = managers.appChatsManager.leave(peerId.toChatId());

      if(flush) {
        promise = promise.then(() => {
          return managers.appMessagesManager.flushHistory(peerId);
        }) as any;
      }

      onSelect?.(promise);
    };

    const callbackDelete = (checked: PopupPeerButtonCallbackCheckboxes) => {
      let promise: Promise<any>;

      if(threadId) {
        promise = managers.appMessagesManager.flushHistory(peerId, false, true, threadId);
      } else if(peerId.isUser()) {
        promise = managers.appMessagesManager.flushHistory(peerId, false, checkboxes ? !!checked.size : undefined);
      } else {
        if(checked.size) {
          promise = managers.appChatsManager.delete(peerId.toChatId());
        } else {
          return callbackLeave(checked);
        }
      }

      onSelect?.(promise);
    };

    let title: LangPackKey,
      titleArgs: FormatterArguments,
      description: LangPackKey,
      descriptionArgs: FormatterArguments,
      buttons: PopupPeerOptions['buttons'],
      checkboxes: PopupPeerOptions['checkboxes'];
    switch(peerType) {
      case 'channel': {
        if(/* actionType === 'delete' &&  */await managers.appChatsManager.hasRights(peerId.toChatId(), 'delete_chat')) {
          title = 'ChannelDeleteMenu';
          description = 'AreYouSureDeleteAndExitChannel';
          buttons = [{
            langKey: 'ChannelDeleteMenu',
            isDanger: true,
            callback: callbackDelete
          }];

          checkboxes = [{
            text: 'DeleteChannelForAll'
          }];
        } else {
          title = 'LeaveChannelMenu';
          description = 'ChannelLeaveAlertWithName';
          descriptionArgs = [peerTitleElement];
          buttons = [{
            langKey: 'LeaveChannel',
            isDanger: true,
            callback: callbackLeave
          }];
        }

        break;
      }

      /* case 'megagroup': {
        title = 'Leave Group?';
        description = `Are you sure you want to leave this group?`;
        buttons = [{
          text: 'LEAVE ' + peerTitleElement,
          isDanger: true,
          callback: callbackLeave
        }];

        break;
      } */

      case 'chat': {
        title = 'DeleteChatUser';
        description = 'AreYouSureDeleteThisChatWithUser';
        descriptionArgs = [peerTitleElement];

        buttons = [{
          langKey: 'DeleteChatUser',
          isDanger: true,
          callback: callbackDelete
        }];

        checkboxes = [{
          text: 'DeleteMessagesOptionAlso',
          textArgs: [
            await wrapPeerTitle({peerId})
          ]
        }];

        break;
      }

      case 'saved': {
        title = 'DeleteChatUser';
        description = 'AreYouSureDeleteThisChatSavedMessages';
        buttons = [{
          langKey: 'DeleteChatUser',
          isDanger: true,
          callback: callbackDelete
        }];

        break;
      }

      case 'megagroup':
      case 'group': {
        if(threadId) {
          title = 'DeleteTopics';
          titleArgs = [1];
          description = 'DeleteSelectedTopic';
          descriptionArgs = [peerTitleElement];
          buttons = [{
            langKey: 'Delete',
            isDanger: true,
            callback: callbackDelete
          }];
        } else if(/* actionType === 'delete' &&  */await managers.appChatsManager.hasRights(peerId.toChatId(), 'delete_chat')) {
          title = 'DeleteMegaMenu';
          description = 'AreYouSureDeleteAndExit';
          buttons = [{
            langKey: 'DeleteMegaMenu',
            isDanger: true,
            callback: callbackDelete
          }];

          checkboxes = [{
            text: 'DeleteChat.DeleteGroupForAll'
          }];
        } else {
          title = 'LeaveMegaMenu';
          description = 'AreYouSureDeleteAndExitName';
          descriptionArgs = [peerTitleElement];
          buttons = [{
            langKey: 'DeleteChatUser',
            isDanger: true,
            callback: (checkboxes) => callbackLeave(checkboxes, true)
          }];
        }

        break;
      }
    }

    PopupElement.createPopup(PopupPeer, 'popup-delete-chat', {
      peerId,
      threadId,
      titleLangKey: title,
      titleLangArgs: titleArgs,
      descriptionLangKey: description,
      descriptionLangArgs: descriptionArgs,
      buttons,
      checkboxes
    }).show();
  }
}
