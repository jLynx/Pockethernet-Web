import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(viteConfig) {
    // Storybook uses the app's Vite config but does not need its service worker.
    const plugins = await Promise.all(viteConfig.plugins?.flat() ?? []);
    viteConfig.plugins = plugins
      .flat()
      .filter(
        (plugin) => !plugin || !('name' in plugin) || !plugin.name.startsWith('vite-plugin-pwa'),
      );
    return viteConfig;
  },
};

export default config;
