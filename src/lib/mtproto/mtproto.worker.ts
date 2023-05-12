/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

// just to include
import '../polyfill';
import '../../helpers/peerIdPolyfill';

import cryptoWorker from '../crypto/cryptoMessagePort';
import {setEnvironment} from '../../environment/utils';
import appStateManager from '../appManagers/appStateManager';
import transportController from './transports/controller';
import MTProtoMessagePort from './mtprotoMessagePort';
import RESET_STORAGES_PROMISE from '../appManagers/utils/storages/resetStoragesPromise';
import appManagersManager from '../appManagers/appManagersManager';
import listenMessagePort from '../../helpers/listenMessagePort';
import {logger} from '../logger';
import {State} from '../../config/state';
import toggleStorages from '../../helpers/toggleStorages';
import appTabsManager from '../appManagers/appTabsManager';
import ServiceMessagePort from '../serviceWorker/serviceMessagePort';
import callbackify from '../../helpers/callbackify';

let _isServiceWorkerOnline = true;
export function isServiceWorkerOnline() {
  return _isServiceWorkerOnline;
}

let serviceMessagePort: ServiceMessagePort<true>, _serviceMessagePort: MessagePort;
export function getServiceMessagePort() {
  return _isServiceWorkerOnline ? serviceMessagePort : undefined;
}

const log = logger('MTPROTO');
// let haveState = false;

const port = new MTProtoMessagePort<false>();
port.addMultipleEventsListeners({
  environment: (environment) => {
    setEnvironment(environment);

    transportController.waitForWebSocket();
  },

  crypto: ({method, args}) => {
    return cryptoWorker.invokeCrypto(method as any, ...args as any);
  },

  state: ({state, resetStorages, pushedKeys, newVersion, oldVersion, userId}) => {
    // if(haveState) {
    //   return;
    // }

    log('got state', state, pushedKeys);

    appStateManager.userId = userId;
    appStateManager.newVersion = newVersion;
    appStateManager.oldVersion = oldVersion;

    RESET_STORAGES_PROMISE.resolve({
      storages: resetStorages,
      callback: () => {
        (Object.keys(state) as any as (keyof State)[]).forEach((key) => {
          appStateManager.pushToState(key, state[key], true, !pushedKeys.includes(key));
        });
      }
    });
    // haveState = true;
  },

  toggleStorages: ({enabled, clearWrite}) => {
    return toggleStorages(enabled, clearWrite);
  },

  event: (payload, source) => {
    log('will redirect event', payload, source);
    port.invokeExceptSource('event', payload, source);
  },

  serviceWorkerOnline: (online) => {
    _isServiceWorkerOnline = online;
  },

  serviceWorkerPort: (payload, source, event) => {
    if(serviceMessagePort) {
      serviceMessagePort.detachPort(_serviceMessagePort);
      _serviceMessagePort = undefined;
    } else {
      serviceMessagePort = new ServiceMessagePort();
      serviceMessagePort.addMultipleEventsListeners({
        requestFilePart: (payload) => {
          return callbackify(appManagersManager.getManagers(), (managers) => {
            const {docId, dcId, offset, limit} = payload;
            return managers.appDocsManager.requestDocPart(docId, dcId, offset, limit);
          });
        }
      });
    }

    // * port can be undefined in the future
    if(_serviceMessagePort = event.ports[0]) {
      serviceMessagePort.attachPort(_serviceMessagePort);
    }
  },

  createObjectURL: (blob) => {
    return URL.createObjectURL(blob);
  }

  // socketProxy: (task) => {
  //   const socketTask = task.payload;
  //   const id = socketTask.id;

  //   const socketProxied = socketsProxied.get(id);
  //   if(socketTask.type === 'message') {
  //     socketProxied.dispatchEvent('message', socketTask.payload);
  //   } else if(socketTask.type === 'open') {
  //     socketProxied.dispatchEvent('open');
  //   } else if(socketTask.type === 'close') {
  //     socketProxied.dispatchEvent('close');
  //     socketsProxied.delete(id);
  //   }
  // },
});

log('MTProto start');

appManagersManager.start();
appManagersManager.getManagers();
appTabsManager.start();

// let sentHello = false;
listenMessagePort(port, (source) => {
  appTabsManager.addTab(source);

  // port.invokeVoid('hello', undefined, source);
  // if(!sentHello) {
  //   port.invokeVoid('hello', undefined, source);
  //   sentHello = true;
  // }
}, (source) => {
  appTabsManager.deleteTab(source);
});
