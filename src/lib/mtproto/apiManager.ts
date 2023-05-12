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

// #if MTPROTO_AUTO
import transportController from './transports/controller';
import MTTransport from './transports/transport';
// #endif

import type {UserAuth} from './mtproto_config';
import type {DcAuthKey, DcId, DcServerSalt, InvokeApiOptions} from '../../types';
import type {MethodDeclMap} from '../../layer';
import type TcpObfuscated from './transports/tcpObfuscated';
import sessionStorage from '../sessionStorage';
import MTPNetworker, {MTMessage} from './networker';
import {ConnectionType, constructTelegramWebSocketUrl, DcConfigurator, TransportType} from './dcConfigurator';
import {logger} from '../logger';
import deferredPromise, {CancellablePromise} from '../../helpers/cancellablePromise';
import App from '../../config/app';
import {MOUNT_CLASS_TO} from '../../config/debug';
import {IDB} from '../files/idb';
import CryptoWorker from '../crypto/cryptoMessagePort';
import ctx from '../../environment/ctx';
import noop from '../../helpers/noop';
import Modes from '../../config/modes';
import bytesFromHex from '../../helpers/bytes/bytesFromHex';
import bytesToHex from '../../helpers/bytes/bytesToHex';
import isObject from '../../helpers/object/isObject';
import pause from '../../helpers/schedulers/pause';
import ApiManagerMethods from './api_methods';
import {getEnvironment} from '../../environment/utils';
import toggleStorages from '../../helpers/toggleStorages';
import tsNow from '../../helpers/tsNow';

/* class RotatableArray<T> {
  public array: Array<T> = [];
  private lastIndex = -1;

  public get() {
    this.lastIndex = clamp(this.lastIndex + 1, 0, this.array.length - 1);
    return this.array[this.lastIndex];
  }
} */

const PREMIUM_FILE_NETWORKERS_COUNT = 6;
const REGULAR_FILE_NETWORKERS_COUNT = 3;

export class ApiManager extends ApiManagerMethods {
  private cachedNetworkers: {
    [transportType in TransportType]: {
      [connectionType in ConnectionType]: {
        [dcId: DcId]: MTPNetworker[]
      }
    }
  };

  private cachedExportPromise: {[x: number]: Promise<unknown>};
  private gettingNetworkers: {[dcIdAndType: string]: Promise<MTPNetworker>};
  private baseDcId: DcId;

  // public telegramMeNotified = false;

  private log: ReturnType<typeof logger>;

  private afterMessageTempIds: {
    [tempId: string]: {
      messageId: string,
      promise: Promise<any>
    }
  };

  private transportType: TransportType;

  private updatesProcessor: (obj: any) => void;

  private loggingOut: boolean;

  constructor() {
    super();
    this.log = logger('API');

    this.cachedNetworkers = {} as any;
    this.cachedExportPromise = {};
    this.gettingNetworkers = {};
    this.baseDcId = 0;
    this.afterMessageTempIds = {};

    this.transportType = Modes.transport;

    // #if MTPROTO_AUTO
    transportController.addEventListener('transport', (transportType) => {
      this.changeTransportType(transportType);
    });
    // #endif

    // * Make sure that the used autologin_token is no more than 10000 seconds old
    // * https://core.telegram.org/api/url-authorization
    const REFRESH_APP_CONFIG_INTERVAL = (10000 - 30) * 1000;
    setInterval(() => {
      this.getConfig(true);
    }, REFRESH_APP_CONFIG_INTERVAL);
  }

  protected after() {
    this.apiUpdatesManager.addMultipleEventsListeners({
      updateConfig: () => {
        this.getConfig(true);
        this.getAppConfig(true);
      }
    });

    this.rootScope.addEventListener('user_auth', () => {
      if(this.config) { // refresh configs if had a config during authorization
        this.apiUpdatesManager.processLocalUpdate({_: 'updateConfig'});
      }
    });

    this.rootScope.addEventListener('premium_toggle', (isPremium) => {
      this.iterateNetworkers(({networker, connectionType, dcId, transportType}) => {
        if(connectionType === 'client' || transportType !== 'websocket') {
          return;
        }

        const transport = networker.transport;
        if(!transport) {
          this.log.error('wow what, no transport?', networker);
          return;
        }

        if((transport as TcpObfuscated).connection) {
          const url = constructTelegramWebSocketUrl(dcId, connectionType, isPremium);
          (transport as TcpObfuscated).changeUrl(url);
        }
      });
    });
  }

  // private lol = false;

  // constructor() {
  // MtpSingleInstanceService.start();

  /* AppStorage.get<number>('dc').then((dcId) => {
      if(dcId) {
        this.baseDcId = dcId;
      }
    }); */
  // }

  /* public telegramMeNotify(newValue: boolean) {
    if(this.telegramMeNotified !== newValue) {
      this.telegramMeNotified = newValue;
      //telegramMeWebService.setAuthorized(this.telegramMeNotified);
    }
  } */

  private getTransportType(connectionType: ConnectionType) {
    // #if MTPROTO_HTTP_UPLOAD
    // @ts-ignore
    const transportType: TransportType = connectionType === 'upload' && getEnvironment().IS_SAFARI ? 'https' : 'websocket';
    // const transportType: TransportType = connectionType !== 'client' ? 'https' : 'websocket';
    // #else
    // @ts-ignore
    const transportType: TransportType = this.transportType;
    // #endif

    return transportType;
  }

  private iterateNetworkers(callback: (o: {networker: MTPNetworker, dcId: DcId, connectionType: ConnectionType, transportType: TransportType, index: number, array: MTPNetworker[]}) => void) {
    for(const transportType in this.cachedNetworkers) {
      const connections = this.cachedNetworkers[transportType as TransportType];
      for(const connectionType in connections) {
        const dcs = connections[connectionType as ConnectionType];
        for(const dcId in dcs) {
          const networkers = dcs[dcId as any as DcId];
          networkers.forEach((networker, idx, arr) => {
            callback({
              networker,
              dcId: +dcId as DcId,
              connectionType: connectionType as ConnectionType,
              transportType: transportType as TransportType,
              index: idx,
              array: arr
            });
          });
        }
      }
    }
  }

  private chooseServer(dcId: DcId, connectionType: ConnectionType, transportType: TransportType) {
    return this.dcConfigurator.chooseServer(dcId, connectionType, transportType, connectionType === 'client', this.rootScope.premium);
  }

  public changeTransportType(transportType: TransportType) {
    const oldTransportType = this.transportType;
    if(oldTransportType === transportType) {
      return;
    }

    this.log('changing transport from', oldTransportType, 'to', transportType);

    const oldObject = this.cachedNetworkers[oldTransportType];
    const newObject = this.cachedNetworkers[transportType];
    this.cachedNetworkers[transportType] = oldObject;
    this.cachedNetworkers[oldTransportType] = newObject;

    this.transportType = transportType;

    for(const oldGetKey in this.gettingNetworkers) {
      const promise = this.gettingNetworkers[oldGetKey];
      delete this.gettingNetworkers[oldGetKey];

      const newGetKey = oldGetKey.replace(oldTransportType, transportType);
      this.gettingNetworkers[newGetKey] = promise;

      this.log('changed networker getKey from', oldGetKey, 'to', newGetKey)
    }

    this.iterateNetworkers((info) => {
      const transportType = this.getTransportType(info.connectionType);
      const transport = this.chooseServer(info.dcId, info.connectionType, transportType);
      this.changeNetworkerTransport(info.networker, transport);
    });
  }

  public async getBaseDcId() {
    if(this.baseDcId) {
      return this.baseDcId;
    }

    const baseDcId = await sessionStorage.get('dc');
    if(!this.baseDcId) {
      if(!baseDcId) {
        this.setBaseDcId(App.baseDcId);
      } else {
        this.baseDcId = baseDcId;
      }
    }

    return this.baseDcId;
  }

  public async setUserAuth(userAuth: UserAuth | UserId) {
    if(typeof(userAuth) === 'string' || typeof(userAuth) === 'number') {
      userAuth = {dcID: 0, date: tsNow(true), id: userAuth.toPeerId(false)};
    }

    this.rootScope.dispatchEvent('user_auth', userAuth);

    if(!userAuth.dcID) {
      const baseDcId = await this.getBaseDcId();
      userAuth.dcID = baseDcId;
    }

    sessionStorage.set({
      user_auth: userAuth
    });

    // this.telegramMeNotify(true);
  }

  public setBaseDcId(dcId: DcId) {
    const wasDcId = this.baseDcId;
    if(wasDcId) { // if migrated set ondrain
      this.getNetworker(wasDcId).then((networker) => {
        this.setOnDrainIfNeeded(networker);
      });
    }

    this.baseDcId = dcId;

    sessionStorage.set({
      dc: this.baseDcId
    });
  }

  public async logOut() {
    if(this.loggingOut) {
      return;
    }

    this.loggingOut = true;
    const storageKeys: Array<DcAuthKey> = [];

    const prefix = 'dc';
    for(let dcId = 1; dcId <= 5; dcId++) {
      storageKeys.push(prefix + dcId + '_auth_key' as any);
    }

    // WebPushApiManager.forceUnsubscribe(); // WARNING // moved to worker's master
    const storageResult = await Promise.all(storageKeys.map((key) => sessionStorage.get(key)));

    const logoutPromises: Promise<any>[] = [];
    for(let i = 0; i < storageResult.length; i++) {
      if(storageResult[i]) {
        logoutPromises.push(this.invokeApi('auth.logOut', {}, {dcId: (i + 1) as DcId, ignoreErrors: true}));
      }
    }

    const clear = async() => {
      this.baseDcId = undefined;
      // this.telegramMeNotify(false);
      await toggleStorages(false, true);
      IDB.closeDatabases();
      this.rootScope.dispatchEvent('logging_out');
    };

    setTimeout(clear, 1e3);

    // return;

    return Promise.all(logoutPromises).catch((error) => {
      error.handled = true;
    }).finally(clear)/* .then(() => {
      location.pathname = '/';
    }) */;
  }

  private generateNetworkerGetKey(dcId: DcId, transportType: TransportType, connectionType: ConnectionType) {
    return [dcId, transportType, connectionType].join('-');
  }

  public getNetworker(dcId: DcId, options: InvokeApiOptions = {}): Promise<MTPNetworker> {
    const connectionType: ConnectionType = options.fileDownload ? 'download' : (options.fileUpload ? 'upload' : 'client');
    // const connectionType: ConnectionType = 'client';

    const transportType = this.getTransportType(connectionType);
    if(!this.cachedNetworkers[transportType]) {
      this.cachedNetworkers[transportType] = {
        client: {},
        download: {},
        upload: {}
      };
    }

    const cache = this.cachedNetworkers[transportType][connectionType];
    if(!(dcId in cache)) {
      cache[dcId] = [];
    }

    const networkers = cache[dcId];
    // @ts-ignore
    const maxNetworkers = connectionType === 'client' || transportType === 'https' ? 1 : (this.rootScope.premium ? PREMIUM_FILE_NETWORKERS_COUNT : REGULAR_FILE_NETWORKERS_COUNT);
    if(networkers.length >= maxNetworkers) {
      let i = maxNetworkers - 1, found = false;
      for(; i >= 0; --i) {
        if(networkers[i].isOnline) {
          found = true;
          break;
        }
      }

      const networker = networkers.splice(found ? i : maxNetworkers - 1, 1)[0];
      networkers.unshift(networker);
      return Promise.resolve(networker);
    }

    let getKey = this.generateNetworkerGetKey(dcId, transportType, connectionType);
    if(this.gettingNetworkers[getKey]) {
      return this.gettingNetworkers[getKey];
    }

    const ak: DcAuthKey = `dc${dcId}_auth_key` as any;
    const ss: DcServerSalt = `dc${dcId}_server_salt` as any;

    let transport = this.chooseServer(dcId, connectionType, transportType);
    return this.gettingNetworkers[getKey] = Promise.all([ak, ss].map((key) => sessionStorage.get(key)))
    .then(async([authKeyHex, serverSaltHex]) => {
      let networker: MTPNetworker, error: any;
      if(authKeyHex && authKeyHex.length === 512) {
        if(!serverSaltHex || serverSaltHex.length !== 16) {
          serverSaltHex = 'AAAAAAAAAAAAAAAA';
        }

        const authKey = bytesFromHex(authKeyHex);
        const authKeyId = (await CryptoWorker.invokeCrypto('sha1', authKey)).slice(-8);
        const serverSalt = bytesFromHex(serverSaltHex);

        networker = this.networkerFactory.getNetworker(dcId, authKey, authKeyId, serverSalt, options);
      } else {
        try { // if no saved state
          const auth = await this.authorizer.auth(dcId);

          sessionStorage.set({
            [ak]: bytesToHex(auth.authKey),
            [ss]: bytesToHex(auth.serverSalt)
          });

          networker = this.networkerFactory.getNetworker(dcId, auth.authKey, auth.authKeyId, auth.serverSalt, options);
        } catch(_error) {
          error = _error;
        }
      }

      // ! cannot get it before this promise because simultaneous changeTransport will change nothing
      const newTransportType = this.getTransportType(connectionType);
      if(newTransportType !== transportType) {
        getKey = this.generateNetworkerGetKey(dcId, newTransportType, connectionType);
        transport.destroy();
        DcConfigurator.removeTransport(this.dcConfigurator.chosenServers, transport);

        if(networker) {
          transport = this.chooseServer(dcId, connectionType, newTransportType);
        }

        this.log('transport has been changed during authorization from', transportType, 'to', newTransportType);
      }

      /* networker.onConnectionStatusChange = (online) => {
        console.log('status:', online);
      }; */

      delete this.gettingNetworkers[getKey];

      if(error) {
        this.log('get networker error', error, (error as Error).stack);
        throw error;
      }

      this.changeNetworkerTransport(networker, transport);
      networkers.unshift(networker);
      this.setOnDrainIfNeeded(networker);
      return networker;
    });
  }

  public getNetworkerVoid(dcId: DcId) {
    return this.getNetworker(dcId).then(noop, noop);
  }

  private changeNetworkerTransport(networker: MTPNetworker, transport?: MTTransport) {
    const oldTransport = networker.transport;
    if(oldTransport) {
      DcConfigurator.removeTransport(this.dcConfigurator.chosenServers, oldTransport);
    }

    networker.changeTransport(transport);
  }

  private onNetworkerDrain(networker: MTPNetworker) {
    this.log('networker drain', networker.dcId);
    networker.onDrain = undefined;
    this.changeNetworkerTransport(networker);
    networker.destroy();
    this.networkerFactory.removeNetworker(networker);
    DcConfigurator.removeTransport(this.cachedNetworkers, networker);
  }

  public setOnDrainIfNeeded(networker: MTPNetworker) {
    if(networker.onDrain) {
      return;
    }

    const checkPromise: Promise<boolean> = networker.isFileNetworker ?
      Promise.resolve(true) :
      this.getBaseDcId().then((baseDcId) => networker.dcId !== baseDcId);
    checkPromise.then((canRelease) => {
      if(networker.onDrain) {
        return;
      }

      if(canRelease) {
        networker.onDrain = () => this.onNetworkerDrain(networker);
        networker.setDrainTimeout();
      }
    });
  }

  public setUpdatesProcessor(callback: (obj: any) => void) {
    this.updatesProcessor = callback;
    this.networkerFactory.setUpdatesProcessor(callback);
  }

  public invokeApi<T extends keyof MethodDeclMap>(method: T, params: MethodDeclMap[T]['req'] = {}, options: InvokeApiOptions = {}): CancellablePromise<MethodDeclMap[T]['res']> {
    // /////this.log('Invoke api', method, params, options);

    /* if(!this.lol) {
      networkerFactory.updatesProcessor({_: 'new_session_created'}, true);
      this.lol = true;
    } */

    const deferred = deferredPromise<MethodDeclMap[T]['res']>();

    let {afterMessageId, prepareTempMessageId} = options;
    if(prepareTempMessageId) {
      deferred.then(() => {
        delete this.afterMessageTempIds[prepareTempMessageId];
      });
    }

    if(MOUNT_CLASS_TO) {
      const startTime = Date.now();
      const interval = ctx.setInterval(() => {
        if(!cachedNetworker || !cachedNetworker.isStopped()) {
          this.log.error('Request is still processing:', method, params, options, 'time:', (Date.now() - startTime) / 1000);
        }
        // this.cachedUploadNetworkers[2].requestMessageStatus();
      }, 5e3);

      deferred.catch(noop).finally(() => {
        clearInterval(interval);
      });
    }

    const rejectPromise = async(error: ApiError) => {
      if(!error) {
        error = {type: 'ERROR_EMPTY'};
      } else if(!isObject(error)) {
        error = {message: error};
      }

      if((error.code === 401 && error.type === 'SESSION_REVOKED') ||
        (error.code === 406 && error.type === 'AUTH_KEY_DUPLICATED')) {
        this.logOut();
      }

      if(options.ignoreErrors) {
        throw error;
      }

      if(error.code === 406) {
        error.handled = true;
      }

      if(!options.noErrorBox) {
        error.input = method;
        error.stack = stack || (error.originalError && error.originalError.stack) || error.stack || (new Error()).stack;
        setTimeout(() => {
          if(!error.handled) {
            if(error.code === 401) {
              this.logOut();
            } else {
              // ErrorService.show({error: error}); // WARNING
            }

            error.handled = true;
          }
        }, 100);
      }

      throw error;
    };

    let dcId: DcId;

    let cachedNetworker: MTPNetworker;
    const stack = (new Error()).stack || 'empty stack';
    const performRequest = (): Promise<any> => {
      if(afterMessageId) {
        const after = this.afterMessageTempIds[afterMessageId];
        if(after) {
          options.afterMessageId = after.messageId;
        }
      }

      const promise = cachedNetworker.wrapApiCall(method, params, options);

      if(prepareTempMessageId) {
        this.afterMessageTempIds[prepareTempMessageId] = {
          messageId: (options as MTMessage).messageId,
          promise: deferred
        };
      }

      return promise.catch((error: ApiError) => {
        // if(!options.ignoreErrors) {
        if(error.type !== 'FILE_REFERENCE_EXPIRED'/*  && error.type !== 'MSG_WAIT_FAILED' */) {
          this.log.error('Error', error.code, error.type, this.baseDcId, dcId, method, params);
        }

        if(error.code === 401 && this.baseDcId === dcId) {
          if(error.type !== 'SESSION_PASSWORD_NEEDED') {
            sessionStorage.delete('dc')
            sessionStorage.delete('user_auth'); // ! возможно тут вообще не нужно это делать, но нужно проверить случай с USER_DEACTIVATED (https://core.telegram.org/api/errors)
            // this.telegramMeNotify(false);
          }

          throw error;
        } else if(error.code === 401 && this.baseDcId && dcId !== this.baseDcId) {
          if(this.cachedExportPromise[dcId] === undefined) {
            const promise = new Promise((exportResolve, exportReject) => {
              this.invokeApi('auth.exportAuthorization', {dc_id: dcId}, {noErrorBox: true}).then((exportedAuth) => {
                this.invokeApi('auth.importAuthorization', {
                  id: exportedAuth.id,
                  bytes: exportedAuth.bytes
                }, {dcId, noErrorBox: true}).then(exportResolve, exportReject);
              }, exportReject);
            });

            this.cachedExportPromise[dcId] = promise;
          }

          return this.cachedExportPromise[dcId].then(() => performRequest());
        } else if(error.code === 303) {
          const newDcId = +error.type.match(/^(PHONE_MIGRATE_|NETWORK_MIGRATE_|USER_MIGRATE_)(\d+)/)[2] as DcId;
          if(newDcId !== dcId) {
            if(options.dcId) {
              options.dcId = newDcId;
            } else {
              this.setBaseDcId(newDcId);
            }

            return this.invokeApi(method, params, options);
          }
        } else if(error.code === 400 && error.type.indexOf('FILE_MIGRATE') === 0) {
          const newDcId = +error.type.match(/^(FILE_MIGRATE_)(\d+)/)[2] as DcId;
          if(newDcId !== dcId) {
            options.dcId = newDcId;
            return this.invokeApi(method, params, options);
          } else {
            throw error;
          }
        } else if(error.code === 400 && error.type === 'CONNECTION_NOT_INITED') {
          this.networkerFactory.unsetConnectionInited();
          return performRequest();
        } else if(!options.rawError && error.code === 420) {
          const waitTime = +error.type.match(/^FLOOD_WAIT_(\d+)/)[1] || 1;

          if(waitTime > (options.floodMaxTimeout ?? 60) && !options.prepareTempMessageId) {
            throw error;
          }

          return pause(waitTime/* (waitTime + 5) */ * 1000).then(() => performRequest());
        } else if(!options.rawError && ['MSG_WAIT_FAILED', 'MSG_WAIT_TIMEOUT'].includes(error.type)) {
          const after = this.afterMessageTempIds[afterMessageId];

          afterMessageId = undefined;
          delete options.afterMessageId;

          if(after) return after.promise.then(() => performRequest());
          else return performRequest();
        } else if(!options.rawError && error.code === 500) {
          const now = Date.now();
          if(options.stopTime) {
            if(now >= options.stopTime) {
              throw error;
            }
          }

          options.waitTime = options.waitTime ? Math.min(60, options.waitTime * 1.5) : 1;
          return pause(options.waitTime * 1000).then(() => performRequest());
        } else if(error.type === 'UNKNOWN' || error.type === 'MTPROTO_CLUSTER_INVALID') { // cluster invalid - request from regular user to premium endpoint
          return pause(1000).then(() => performRequest());
        } else {
          throw error;
        }
      });
    }

    let p: Promise<MTPNetworker>;
    if(dcId = (options.dcId || this.baseDcId)) {
      p = this.getNetworker(dcId, options);
    } else {
      p = this.getBaseDcId().then((baseDcId) => this.getNetworker(dcId = baseDcId, options));
    }

    p.then((networker) => {
      cachedNetworker = networker;
      const promise = performRequest();
      cachedNetworker.attachPromise(deferred, options as MTMessage);
      return promise;
    })
    .then(deferred.resolve)
    .catch(rejectPromise)
    .catch(deferred.reject);

    return deferred;
  }
}
