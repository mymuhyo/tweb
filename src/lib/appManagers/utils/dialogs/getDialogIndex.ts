/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import type {Dialog, ForumTopic} from '../../../../layer';
import type {REAL_FOLDER_ID} from '../../../mtproto/mtproto_config';
import getDialogIndexKey from './getDialogIndexKey';

export default function getDialogIndex(
  dialog: Dialog.dialog | ForumTopic.forumTopic,
  indexKey: ReturnType<typeof getDialogIndexKey> = getDialogIndexKey((dialog as Dialog).folder_id as REAL_FOLDER_ID)
) {
  return dialog?.[indexKey as 'index_0'];
}
