/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import type {DownloadMediaOptions, DownloadOptions} from '../mtproto/apiFileManager';
import type {AppMessagesManager} from './appMessagesManager';
import type {MyDocument} from './appDocsManager';
import deferredPromise, {CancellablePromise} from '../../helpers/cancellablePromise';
import {InputFile, Photo, PhotoSize} from '../../layer';
import getFileNameForUpload from '../../helpers/getFileNameForUpload';
import {AppManagers} from './managers';
import rootScope from '../rootScope';
import {MOUNT_CLASS_TO} from '../../config/debug';
import noop from '../../helpers/noop';
import getDownloadMediaDetails from './utils/download/getDownloadMediaDetails';
import getDownloadFileNameFromOptions from './utils/download/getDownloadFileNameFromOptions';
import indexOfAndSplice from '../../helpers/array/indexOfAndSplice';
import makeError from '../../helpers/makeError';
import createDownloadAnchor from '../../helpers/dom/createDownloadAnchor';
import {getFileNameByLocation} from '../../helpers/fileName';
import getDocumentDownloadOptions from './utils/docs/getDocumentDownloadOptions';
import getPhotoDownloadOptions from './utils/photos/getPhotoDownloadOptions';
import apiManagerProxy from '../mtproto/mtprotoworker';

export type ResponseMethodBlob = 'blob';
export type ResponseMethodJson = 'json';
export type ResponseMethod = ResponseMethodBlob | ResponseMethodJson;

/* export type DownloadBlob = {promise: Promise<Blob>, controller: AbortController};
export type DownloadJson = {promise: Promise<any>, controller: AbortController}; */
export type DownloadBlob = CancellablePromise<Blob>;
export type DownloadUrl = CancellablePromise<string>;
export type DownloadJson = CancellablePromise<any>;
// export type Download = DownloadBlob/*  | DownloadJson */;
export type Download = DownloadBlob | DownloadUrl/*  | DownloadJson */;

export type Progress = {done: number, fileName: string, total: number, offset: number};
export type ProgressCallback = (details: Progress) => void;

type DownloadType = 'url' | 'blob' | 'void' | 'disc';

export class AppDownloadManager {
  private downloads: {[fileName: string]: {main: Download} & {[type in DownloadType]?: Download}} = {};
  // private downloadsToDisc: {[fileName: string]: Download} = {};
  private progress: {[fileName: string]: Progress} = {};
  // private progressCallbacks: {[fileName: string]: Array<ProgressCallback>} = {};
  private managers: AppManagers;

  public construct(managers: AppManagers) {
    this.managers = managers;
    rootScope.addEventListener('download_progress', (details) => {
      // const callbacks = this.progressCallbacks[details.fileName];
      // if(callbacks) {
      //   callbacks.forEach((callback) => callback(details));
      // }

      const download = this.downloads[details.fileName];
      if(download?.main?.notifyAll) {
        this.progress[details.fileName] = details;
        download.main.notifyAll(details);
      }
    });
  }

  private getNewDeferred<T>(fileName: string, type?: DownloadType) {
    const deferred = deferredPromise<T>();

    let download = this.downloads[fileName];
    if(!download) {
      download = this.downloads[fileName] = {
        main: deferred as any
      };

      deferred.cancel = () => {
        const error = makeError('DOWNLOAD_CANCELED');

        this.managers.apiFileManager.cancelDownload(fileName);

        deferred.reject(error);
        deferred.cancel = noop;
      };

      deferred.catch(() => {
        this.clearDownload(fileName, type);
      }).finally(() => {
        delete this.progress[fileName];
        // delete this.progressCallbacks[fileName];
      });
    } else {
      const main = download.main;
      (['cancel', 'addNotifyListener', 'notify', 'notifyAll'] as (keyof CancellablePromise<void>)[]).forEach((key) => {
        if(!main[key]) {
          return;
        }

        // @ts-ignore
        deferred[key] = main[key].bind(main);
      });
    }

    const haveToClear = type === 'disc';
    if(haveToClear) {
      deferred.catch(noop).finally(() => {
        this.clearDownload(fileName, type);
      });
    }

    return download[type] = deferred as any;
  }

  public getNewDeferredForUpload<T extends Promise<any>>(fileName: string, promise: T) {
    const deferred = this.getNewDeferred<InputFile>(fileName);
    promise.then(deferred.resolve, deferred.reject);

    deferred.finally(() => {
      this.clearDownload(fileName);
    });

    return deferred as CancellablePromise<Awaited<T>>;
  }

  private clearDownload(fileName: string, type?: DownloadType) {
    const downloads = this.downloads[fileName];
    if(!downloads) {
      return;
    }

    delete downloads[type];

    const length = Object.keys(downloads).length;
    if(!length || (downloads.main && length === 1)) {
      delete this.downloads[fileName];
    }
  }

  public getUpload(fileName: string): ReturnType<AppMessagesManager['sendFile']>['promise'] {
    let deferred: CancellablePromise<any> = this.getDownload(fileName);
    if(deferred) {
      return deferred;
    }

    deferred = this.getNewDeferred(fileName);
    this.managers.appMessagesManager.getUploadPromise(fileName).then(deferred.resolve, deferred.reject);
    return deferred;
  }

  /* public fakeDownload(fileName: string, value: Blob | string) {
    const deferred = this.getNewDeferred<Blob>(fileName);
    if(typeof(value) === 'string') {
      fetch(value)
      .then((response) => response.blob())
      .then((blob) => deferred.resolve(blob));
    } else {
      deferred.resolve(value);
    }

    return deferred;
  } */

  private d(fileName: string, getPromise: () => Promise<any>, type?: DownloadType) {
    let deferred = this.getDownload(fileName, type);
    if(deferred) return deferred;

    deferred = this.getNewDeferred<Blob>(fileName, type);
    getPromise().then(deferred.resolve, deferred.reject);
    return deferred;
  }

  public download(options: DownloadOptions): DownloadBlob {
    const fileName = getDownloadFileNameFromOptions(options);
    return this.d(fileName, () => this.managers.apiFileManager.download(options), 'blob') as any;
  }

  public downloadMedia(options: DownloadMediaOptions, type: DownloadType = 'blob', promiseBefore?: Promise<any>): DownloadBlob {
    const {downloadOptions, fileName} = getDownloadMediaDetails(options);

    return this.d(fileName, () => {
      let cb: any;
      if(type === 'url') {
        cb = this.managers.apiFileManager.downloadMediaURL;
      } else if(type === 'void'/*  || type === 'disc' */) {
        cb = this.managers.apiFileManager.downloadMediaVoid;
      } else /* if(type === 'blob') */ {
        cb = this.managers.apiFileManager.downloadMedia;
      }

      if(promiseBefore) {
        return promiseBefore.then(() => cb(options));
      }

      return cb(options);
    }, type) as any;
  }

  public downloadMediaURL(options: DownloadMediaOptions): DownloadUrl {
    return this.downloadMedia(options, 'url') as any;
  }

  public downloadMediaVoid(options: DownloadMediaOptions): DownloadBlob {
    return this.downloadMedia(options, 'void');
  }

  public upload(file: File | Blob, fileName?: string, promise?: Promise<any>) {
    if(!fileName) {
      fileName = getFileNameForUpload(file);
    }

    if(!promise) {
      promise = this.managers.apiFileManager.upload({file, fileName});
    }

    const deferred = this.getNewDeferredForUpload(fileName, promise);
    return deferred as any as CancellablePromise<InputFile>;
  }

  public getDownload(fileName: string, type?: DownloadType) {
    const d = this.downloads[fileName];
    return d && d[type];
  }

  // public addProgressCallback(fileName: string, callback: ProgressCallback) {
  //   const progress = this.progress[fileName];
  //   (this.progressCallbacks[fileName] ?? (this.progressCallbacks[fileName] = [])).push(callback);

  //   if(progress) {
  //     callback(progress);
  //   }
  // }

  public downloadToDisc(options: DownloadMediaOptions, justAttach?: boolean) {
    const media = options.media;
    const isDocument = media._ === 'document';
    if(!isDocument && !options.thumb) {
      options.thumb = (media as Photo.photo).sizes.slice().pop() as PhotoSize.photoSize;
    }

    // const {fileName: cacheFileName} = getDownloadMediaDetails(options);
    // if(justAttach) {
    //   const promise = this.downloadsToDisc[cacheFileName];
    //   if(promise) {
    //     return promise;
    //   }
    // }

    // const {downloadOptions, fileName} = getDownloadMediaDetails(options);
    // if(downloadOptions.size && downloadOptions.size > MAX_FILE_SAVE_SIZE) {
    const id = '' + (Math.random() * 0x7FFFFFFF | 0);
    // const id = 'test';
    const url = `download/${id}`;
    options.downloadId = id;

    const pingPromise = apiManagerProxy.pingServiceWorkerWithIframe();

    const promise = this.downloadMedia(options, 'disc', pingPromise);
    // this.downloadsToDisc[cacheFileName] = promise;

    if(justAttach) {
      return promise;
    }

    const iframe = document.createElement('iframe');
    iframe.hidden = true;

    pingPromise.then(() => {
      iframe.src = url;
      document.body.append(iframe);
    });

    // createDownloadAnchor(url, 'asd.txt');

    // const events = [
    //   'emptied',
    //   'abort',
    //   'suspend',
    //   'reset',
    //   'error',
    //   'ended',
    //   'load'
    // ].forEach((event) => {
    //   iframe.addEventListener(event, () => alert(event));
    //   iframe.contentWindow.addEventListener(event, () => alert(event));
    // });

    let element: HTMLElement, hadProgress = false;
    const onProgress = () => {
      if(hadProgress) {
        return;
      }

      hadProgress = true;
      element = iframe;

      indexOfAndSplice(promise.listeners, onProgress);
    };

    promise.addNotifyListener(onProgress);
    promise.then((blob) => {
      if(!blob) {
        return;
      }

      const url = URL.createObjectURL(blob);
      const downloadOptions = isDocument ?
        getDocumentDownloadOptions(media) :
        getPhotoDownloadOptions(media as any, options.thumb as PhotoSize.photoSize);
      const fileName = (options.media as MyDocument).file_name || getFileNameByLocation(downloadOptions.location);
      createDownloadAnchor(url, downloadOptions.fileName || fileName, () => {
        URL.revokeObjectURL(url);
      });
    }).catch(noop).finally(() => {
      if(!hadProgress) {
        onProgress();
      }

      setTimeout(() => {
        element?.remove();
      }, 1000);

      // if(this.downloadsToDisc[cacheFileName] === promise) {
      //   delete this.downloadsToDisc[cacheFileName];
      // }
    });

    return promise;
  }
}

const appDownloadManager = new AppDownloadManager();
MOUNT_CLASS_TO && (MOUNT_CLASS_TO.appDownloadManager = appDownloadManager);
export default appDownloadManager;
