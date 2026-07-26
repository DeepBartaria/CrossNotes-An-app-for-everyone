import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

export default function DraggableOverlay({ overlay, isSelected, onSelect, onUpdate, onAction }) {
  const x = useSharedValue(overlay.x || 0);
  const y = useSharedValue(overlay.y || 0);
  const scale = useSharedValue(overlay.scale || 1);
  const rotation = useSharedValue(overlay.rotation || 0);
  
  const savedX = useSharedValue(overlay.x || 0);
  const savedY = useSharedValue(overlay.y || 0);
  const savedScale = useSharedValue(overlay.scale || 1);
  const savedRotation = useSharedValue(overlay.rotation || 0);

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      runOnJS(onSelect)();
    });

  const panGesture = Gesture.Pan()
    .enabled(isSelected)
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
      runOnJS(onUpdate)({ x: x.value, y: y.value, scale: scale.value, rotation: rotation.value });
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(isSelected)
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(onUpdate)({ x: x.value, y: y.value, scale: scale.value, rotation: rotation.value });
    });

  const rotationGesture = Gesture.Rotation()
    .enabled(isSelected)
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
      runOnJS(onUpdate)({ x: x.value, y: y.value, scale: scale.value, rotation: rotation.value });
    });
    
  const longPressGesture = Gesture.LongPress()
    .enabled(isSelected)
    .onStart((e) => {
      runOnJS(onAction)('menu', e.absoluteX, e.absoluteY);
    });

  // Combine interactions. Tap must work even if not selected.
  const composed = Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture, longPressGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` }
    ]
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, animatedStyle, isSelected && styles.selected]}>
        {overlay.type === 'image' ? (
          <Image source={{ uri: overlay.content }} style={styles.image} />
        ) : (
          <Text style={styles.text}>{overlay.content}</Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    zIndex: 100, // Higher z-index to ensure it captures touches over canvas
  },
  selected: {
    borderColor: '#2965B2',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(41, 101, 178, 0.05)',
  },
  image: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
  },
  text: {
    fontSize: 24,
    color: '#000',
  }
});
