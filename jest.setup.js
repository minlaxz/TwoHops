/* eslint-env jest */
// Standard React Native testing practice: reanimated and haptics are native
// libraries mocked out under jest. Reanimated 4's shipped mock still runs a
// native initializer that throws here, so the hooks this app uses are stubbed
// by hand: animations resolve to their target value immediately.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = value => value;
  const createAnimatedComponent = component => component;
  const layoutAnimation = { duration: () => layoutAnimation };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent },
    createAnimatedComponent,
    FadeIn: layoutAnimation,
    FadeInDown: layoutAnimation,
    FadeOut: layoutAnimation,
    LinearTransition: layoutAnimation,
    useSharedValue: initial => ({ value: initial }),
    useAnimatedStyle: worklet => worklet(),
    useReducedMotion: () => false,
    withTiming: identity,
    withSequence: identity,
    withRepeat: identity,
    cancelAnimation: () => {},
  };
});
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
}));
// Gesture handler ships its own jest mocks; the bottom sheet's shipped mock
// renders its children unconditionally, so the modal is re-stubbed here to
// render only between present() and dismiss() — that is the behavior the
// app-render seam observes.
require('react-native-gesture-handler/jestSetup');
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const mock = require('@gorhom/bottom-sheet/mock');
  class BottomSheetModal extends React.Component {
    state = { presented: false };
    present() {
      this.setState({ presented: true });
    }
    dismiss() {
      this.setState({ presented: false });
      this.props.onDismiss?.();
    }
    close() {
      this.dismiss();
    }
    forceClose() {
      this.dismiss();
    }
    render() {
      return this.state.presented ? this.props.children : null;
    }
  }
  return { ...mock, BottomSheetModal };
});
