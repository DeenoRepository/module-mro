import { describe, it, expect, vi } from 'vitest';
import { MroModule } from './index.js';

describe('MroModule lifecycle and exports', () => {
  it('registers navigation in onInit', async () => {
    const registerNavigation = vi.fn();
    const ctx = { registerNavigation };

    await MroModule.onInit(ctx);
    expect(registerNavigation).toHaveBeenCalledWith({
      id: 'mro-menu',
      title: 'Maintenance & Repairs',
      path: '/mro',
      permission: 'mro:work_order:read'
    });
  });

  it('runs onStart and onStop without errors', async () => {
    await expect(MroModule.onStart()).resolves.toBeUndefined();
    await expect(MroModule.onStop()).resolves.toBeUndefined();
  });
});
