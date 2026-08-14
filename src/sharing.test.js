import { describe, expect, it } from 'vitest';
import { chooseSharedSpace } from './sharing.js';

describe('chooseSharedSpace', () => {
  it('verwendet ohne eingehende Freigabe den eigenen Bereich', () => {
    expect(chooseSharedSpace('user-1', [])).toEqual({ ownerId: 'user-1', isShared: false, shareId: null });
  });

  it('verwendet beim Partner den Bereich des Eigentümers', () => {
    expect(chooseSharedSpace('partner', [{ id: 'share-1', owner_id: 'owner', partner_id: 'partner' }]))
      .toEqual({ ownerId: 'owner', isShared: true, shareId: 'share-1' });
  });
});
