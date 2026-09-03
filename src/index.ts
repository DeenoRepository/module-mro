export * from './domain/maintenance-service.js';

export const MroModule = {
  id: 'module-mro',
  version: '1.0.0',
  async onInit(ctx: any) {
    ctx.registerNavigation({
      id: 'mro-menu',
      title: 'РўРћРёР  Рё РѕР±СЃР»СѓР¶РёРІР°РЅРёРµ',
      path: '/mro',
      permission: 'mro:schedule:read'
    });
  },
  async onStart() {},
  async onStop() {}
};
