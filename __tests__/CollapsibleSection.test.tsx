import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import CollapsibleSection from '../src/components/CollapsibleSection';
import { ThemeProvider } from '../src/context/ThemeContext';

async function mount(initialExpanded: boolean) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <CollapsibleSection
          title="Advanced"
          initialExpanded={initialExpanded}
          testID="section-advanced"
        >
          <Text>Body content</Text>
        </CollapsibleSection>
      </ThemeProvider>,
    );
  });
  return renderer;
}

function header(renderer: ReactTestRenderer.ReactTestRenderer) {
  // Pressable spreads props over nested nodes; take the outermost match.
  return renderer.root.findAll(
    node =>
      node.props.testID === 'section-advanced' &&
      typeof node.props.onPress === 'function',
  )[0];
}

function bodyVisible(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .some(node => node.props.children === 'Body content');
}

test('starts collapsed, expands on header press', async () => {
  const renderer = await mount(false);

  expect(bodyVisible(renderer)).toBe(false);
  expect(header(renderer).props.accessibilityState.expanded).toBe(false);

  await ReactTestRenderer.act(async () => {
    header(renderer).props.onPress();
  });

  expect(bodyVisible(renderer)).toBe(true);
  expect(header(renderer).props.accessibilityState.expanded).toBe(true);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('starts expanded, collapses on header press', async () => {
  const renderer = await mount(true);

  expect(bodyVisible(renderer)).toBe(true);

  await ReactTestRenderer.act(async () => {
    header(renderer).props.onPress();
  });

  expect(bodyVisible(renderer)).toBe(false);
  expect(header(renderer).props.accessibilityState.expanded).toBe(false);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});
