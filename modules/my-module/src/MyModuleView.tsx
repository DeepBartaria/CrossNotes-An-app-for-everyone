import { requireNativeView } from 'expo';
import * as React from 'react';
import { ViewProps } from 'react-native';

export type MyModuleViewProps = ViewProps & {
  color?: string;
  isEraser?: boolean;
  strokeWidth?: number;
};

const NativeView: React.ComponentType<MyModuleViewProps> =
  requireNativeView('MyModule');

export default React.forwardRef(function MyModuleView(props: MyModuleViewProps, ref: React.ForwardedRef<any>) {
  return <NativeView {...props} ref={ref} />;
});
