/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import isAnyChat from '../lib/appManagers/utils/peers/isAnyChat';
import isUser from '../lib/appManagers/utils/peers/isUser';

String.prototype.toUserId = function() {
  return (+this).toUserId();
};

String.prototype.toChatId = function() {
  return (+this).toChatId();
};

String.prototype.toPeerId = function(isChat?: boolean) {
  return (+this).toPeerId(isChat);
};

String.prototype.isPeerId = function() {
  return /^[\d-]/.test(this.toString());
};

Number.prototype.toUserId = function() {
  return this as any;
};

Number.prototype.toChatId = function() {
  return Math.abs(this as any);
};

Number.prototype.toPeerId = function(isChat?: boolean) {
  return isChat === undefined ? this as number : (isChat ? -Math.abs(this as number) : this as number);
};

Number.prototype.isPeerId = function() {
  return true;
};

[
  ['isUser' as const, isUser],
  ['isAnyChat' as const, isAnyChat]
].forEach((value) => {
  const newMethod = Array.isArray(value) ? value[0] : value;
  const originMethod = Array.isArray(value) ? value[1] : value;
  // @ts-ignore
  String.prototype[newMethod] = function() {
    // @ts-ignore
    // eslint-disable-next-line no-useless-call
    return originMethod.call(null, this.toString());
  };

  // @ts-ignore
  Number.prototype[newMethod] = function() {
    // @ts-ignore
    // eslint-disable-next-line no-useless-call
    return originMethod.call(null, this);
  };
});

declare global {
  interface String {
    toUserId(): UserId;
    toChatId(): ChatId;
    toPeerId(isChat?: boolean): PeerId;
    isPeerId(): this is string;

    isUser(): boolean;
    isAnyChat(): boolean;
  }

  interface Number {
    toUserId(): UserId;
    toChatId(): ChatId;
    toPeerId(isChat?: boolean): PeerId;
    isPeerId(): this is PeerId;

    isUser(): boolean;
    isAnyChat(): boolean;
  }
}

export {};
