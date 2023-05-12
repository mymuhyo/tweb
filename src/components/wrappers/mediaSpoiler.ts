/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import cancelEvent from '../../helpers/dom/cancelEvent';
import getImageFromStrippedThumb from '../../helpers/getImageFromStrippedThumb';
import noop from '../../helpers/noop';
import {Document, Photo, PhotoSize} from '../../layer';
import DotRenderer from '../dotRenderer';
import SetTransition from '../singleTransition';

export function toggleMediaSpoiler(options: {
  mediaSpoiler: HTMLElement,
  reveal: boolean,
  destroyAfter?: boolean
}) {
  const {mediaSpoiler, reveal, destroyAfter} = options;
  SetTransition({
    element: mediaSpoiler,
    forwards: reveal,
    className: 'is-revealing',
    duration: 250,
    onTransitionEnd: () => {
      if(reveal && destroyAfter) {
        mediaSpoiler.remove();
        mediaSpoiler.middlewareHelper.destroy();
      }
    }
  });
}

export function onMediaSpoilerClick(options: {
  mediaSpoiler: HTMLElement,
  event: Event
}) {
  const {mediaSpoiler, event} = options;
  cancelEvent(event);

  if(mediaSpoiler.classList.contains('is-revealing')) {
    return;
  }

  const video = mediaSpoiler.parentElement.querySelector('video');
  if(video && !mediaSpoiler.parentElement.querySelector('.video-play')) {
    video.autoplay = true;
    video.play().catch(noop);
  }

  toggleMediaSpoiler({
    mediaSpoiler,
    reveal: true,
    destroyAfter: true
  });
}

export function wrapMediaSpoilerWithImage(options: {
  image: Awaited<ReturnType<typeof getImageFromStrippedThumb>>['image']
} & Parameters<typeof DotRenderer['create']>[0]) {
  const {middleware, image} = options;
  if(!middleware()) {
    return;
  }

  image.classList.add('media-spoiler-thumbnail');

  const container = document.createElement('div');
  container.classList.add('media-spoiler-container');
  container.middlewareHelper = middleware.create();

  const dotRenderer = DotRenderer.create({
    ...options,
    middleware: container.middlewareHelper.get()
  });

  container.append(image, dotRenderer.canvas);

  return container;
}

export default async function wrapMediaSpoiler(
  options: Omit<Parameters<typeof wrapMediaSpoilerWithImage>[0], 'image'> & {
    media: Document.document | Photo.photo
  }
) {
  const {media} = options;
  const sizes = (media as Photo.photo).sizes || (media as Document.document).thumbs;
  const thumb = sizes.find((size) => size._ === 'photoStrippedSize') as PhotoSize.photoStrippedSize;
  if(!thumb) {
    return;
  }

  const {image, loadPromise} = getImageFromStrippedThumb(media, thumb, true);
  await loadPromise;

  return wrapMediaSpoilerWithImage({
    ...options,
    image
  });
}
