/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import type {MyDocument} from '../lib/appManagers/appDocsManager';
import {applyColorOnContext} from '../lib/rlottie/rlottiePlayer';
import rootScope from '../lib/rootScope';
import customProperties from './dom/customProperties';

const savingLottiePreview: {[docId: DocId]: {width: number, height: number}} = {};

export function isSavingLottiePreview(doc: MyDocument, toneIndex: number | string, width: number, height: number) {
  const key = doc.id + '-' + toneIndex;
  const saving = savingLottiePreview[key];
  return saving && saving.width >= width && saving.height >= height;
}

let sharedCanvas: HTMLCanvasElement, sharedContext: CanvasRenderingContext2D;

export async function saveLottiePreview(doc: MyDocument, canvas: HTMLCanvasElement, toneIndex: number | string) {
  const key = doc.id + '-' + toneIndex;
  const {width, height} = canvas;
  if(isSavingLottiePreview(doc, toneIndex, width, height)) {
    return;
  }

  const saving = savingLottiePreview[key] = {
    width,
    height
  };

  const thumb = await rootScope.managers.appDocsManager.getLottieCachedThumb(doc.id, toneIndex);
  if(savingLottiePreview[key] !== saving) {
    return;
  }

  if(thumb && thumb.w >= width && thumb.h >= height) {
    return;
  }

  if(typeof(toneIndex) === 'string') {
    if(!sharedCanvas) {
      rootScope.addEventListener('theme_change', () => {
        rootScope.managers.appDocsManager.clearColoredStickerThumbs();

        for(const key in savingLottiePreview) {
          const [, toneIndex] = key.split('-');
          if(isNaN(+toneIndex)) {
            delete savingLottiePreview[key];
          }
        }
      });

      sharedCanvas = document.createElement('canvas');
      sharedContext = sharedCanvas.getContext('2d');
    }

    sharedCanvas.width = width;
    sharedCanvas.height = height;
    sharedContext.drawImage(canvas, 0, 0, width, height);
    applyColorOnContext(sharedContext, customProperties.getProperty(toneIndex), 0, 0, width, height);
    canvas = sharedCanvas;
  }

  const promise = new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob));
  });

  const blob = await promise;
  if(savingLottiePreview[key] !== saving) {
    return;
  }

  if(!blob) {
    console.error('trying to save sticker preview with no blob', arguments);
    debugger;
    return;
  }

  rootScope.managers.appDocsManager.saveLottiePreview(doc.id, blob, width, height, toneIndex);
}
