import { describe, it, expect } from 'vitest';
import {
  UNSUPPORTED_TYPE_FLAG,
  UNSUPPORTED_SOURCE_FLAG,
  PERSIST_FAILED_FLAG,
  CONFLICT_FLAG,
  EMPTY_OVERWRITE_FLAG,
} from './constants.js';

describe('constants', () => {
  it('UNSUPPORTED_TYPE_FLAG is defined', () => {
    expect(UNSUPPORTED_TYPE_FLAG).toBeDefined();
  });
  it('UNSUPPORTED_SOURCE_FLAG is defined', () => {
    expect(UNSUPPORTED_SOURCE_FLAG).toBeDefined();
  });
  it('PERSIST_FAILED_FLAG is defined', () => {
    expect(PERSIST_FAILED_FLAG).toBeDefined();
  });
  it('CONFLICT_FLAG is defined', () => {
    expect(CONFLICT_FLAG).toBeDefined();
  });
  it('EMPTY_OVERWRITE_FLAG is defined', () => {
    expect(EMPTY_OVERWRITE_FLAG).toBeDefined();
  });
});
