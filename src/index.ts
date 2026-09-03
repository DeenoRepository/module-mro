export * from './domain/maintenance-service.js';
export * from './domain/work-order-aggregate.js';

export const MroModule = {
  id: 'module-mro',
  version: '1.0.0',
  async onInit(ctx: any) {
    ctx.registerNavigation({
      id: 'mro-menu',
      title: 'Maintenance & Overhaul',
      path: '/mro',
      permission: 'mro:schedule:read'
    });
  },
  async onStart() {},
  async onStop() {}
};
