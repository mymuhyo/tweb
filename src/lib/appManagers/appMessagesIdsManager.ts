/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import {MESSAGE_ID_OFFSET} from '../mtproto/mtproto_config';
import getServerMessageId from './utils/messageId/getServerMessageId';

export class AppMessagesIdsManager {
  // private channelLocals: {[channelId: ChatId]: number} = {};
  // private channelsByLocals: {[local: number]: ChatId} = {};
  // private channelCurLocal = 0;

  public generateTempMessageId(messageId: number, channelId: ChatId) {
    return +(this.generateMessageId(messageId, channelId) + 0.0001).toFixed(4);
  }

  public generateMessageId(messageId: number, channelId: ChatId) {
    if(
      !channelId ||
      !Number.isInteger(messageId) ||
      messageId <= 0
    ) {
      return messageId;
    }

    messageId = getServerMessageId(messageId);
    // let localStart = this.channelLocals[channelId];
    const localStart = MESSAGE_ID_OFFSET;
    // if(!localStart) {
    //   localStart = ++this.channelCurLocal * MESSAGE_ID_OFFSET;
    //   this.channelsByLocals[localStart] = channelId;
    //   this.channelLocals[channelId] = localStart;
    // }

    return localStart + messageId;
  }

  public isLegacyMessageId(messageId: number) {
    return typeof(messageId) === 'number' && messageId < MESSAGE_ID_OFFSET;
  }

  public incrementMessageId(messageId: number, increment: number) {
    return this.generateMessageId(getServerMessageId(messageId) + increment, this.isLegacyMessageId(messageId) ? 1 : 0);
  }

  public getMessageIdInfo(mid: number, channelId?: ChatId) {
    const messageId = getServerMessageId(mid);
    return {messageId, channelId: mid === messageId ? undefined : channelId};
    // if(mid === messageId) {
    //   return {messageId, channelId: undefined as number};
    // }

    // const channelId = this.channelsByLocals[mid - messageId];
    // return {messageId, channelId};
  }

  public splitMessageIdsByChannels(mids: number[], _channelId?: ChatId) {
    const out: Array<[ChatId, {mids: number[], messageIds: number[]}]> = [];
    let prevItem: typeof out[0];
    for(let i = 0, length = mids.length; i < length; ++i) {
      const mid = mids[i];
      const {messageId, channelId} = this.getMessageIdInfo(mid, _channelId);
      if(!prevItem || prevItem[0] !== channelId) {
        prevItem = [channelId, {mids: [], messageIds: []}];
        out.push(prevItem);
      }

      prevItem[1].mids.push(mid);
      prevItem[1].messageIds.push(messageId);
    }

    return out;
  }
}
