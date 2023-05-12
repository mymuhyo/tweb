/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

export default function toggleDisability(elements: HTMLElement[], disable: boolean): () => void {
  if(disable) {
    elements.forEach((el) => el.setAttribute('disabled', 'true'));
  } else {
    elements.forEach((el) => el.removeAttribute('disabled'));
  }

  return () => toggleDisability(elements, !disable);
}
