import type { Preview } from '@storybook/react-vite';
import '../src/shared/ui/primitives.css';
import '../src/styles.css';
import '../src/features/measurements/results/results.css';
import '../src/features/tools/tools.css';
import '../src/features/measurements/results/wiremap.css';
import '../src/features/measurements/results/tdr.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on.*' },
    controls: { expanded: true },
    layout: 'padded',
  },
};

export default preview;
