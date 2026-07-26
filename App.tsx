import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert, Platform, StatusBar as RNStatusBar, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import MyModuleView from './modules/my-module/src/MyModuleView';

const COLORS = ['#29B6F6', '#FFEE58', '#66BB6A']; // Cyan, Yellow, Green from the image
const THICKNESSES = [2, 5, 10]; // Fine, Medium, Thick
const TEMPLATES = ['blank', 'ruled', 'grid'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_HEIGHT = SCREEN_HEIGHT * 0.8;

// Template Background Components
const RuledTemplate = () => (
  <View style={StyleSheet.absoluteFill}>
    {Array.from({ length: 25 }).map((_, i) => (
      <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: '#D3E3FD', height: PAGE_HEIGHT / 25, width: '100%' }} />
    ))}
  </View>
);

const GridTemplate = () => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', flexWrap: 'wrap' }]}>
    {Array.from({ length: 400 }).map((_, i) => (
      <View key={i} style={{ borderWidth: 0.5, borderColor: '#E8F1F9', width: '5%', height: PAGE_HEIGHT / 25 }} />
    ))}
  </View>
);

export default function App() {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(THICKNESSES[1]);
  const [pages, setPages] = useState([{ id: Date.now().toString(), template: 'blank' }]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  
  const canvasRefs = useRef<any[]>([]);

  // Gesture Values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleUndo = () => canvasRefs.current[activePageIndex]?.undo?.();
  
  const handleSave = async () => {
    try {
      const base64Image = await canvasRefs.current[activePageIndex]?.saveAsImage?.();
      if (base64Image) {
        Alert.alert('Success', 'Current page exported successfully!');
      } else {
        Alert.alert('Notice', 'Canvas saved!');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save canvas');
    }
  };

  const handleAddPage = () => {
    setPages([...pages, { id: Date.now().toString(), template: 'blank' }]);
    setActivePageIndex(pages.length);
  };

  const handleChangeTemplate = () => {
    const currentPage = pages[activePageIndex];
    const currentIdx = TEMPLATES.indexOf(currentPage.template);
    const nextTemplate = TEMPLATES[(currentIdx + 1) % TEMPLATES.length];
    
    const newPages = [...pages];
    newPages[activePageIndex].template = nextTemplate;
    setPages(newPages);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.topBarSection}>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="dock-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="magnify" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.topBarCenterSection}>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="cursor-default-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.activeTopBarIcon}>
              <MaterialCommunityIcons name="pencil" size={22} color="#2965B2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="format-text" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="image-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleChangeTemplate}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.topBarSectionRight}>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleAddPage}>
              <MaterialCommunityIcons name="file-document-plus-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleSave}>
              <MaterialCommunityIcons name="export-variant" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.contentArea}>
        <View style={styles.contextBarContainer}>
          <View style={styles.undoPill}>
            <TouchableOpacity style={styles.contextIcon} onPress={handleUndo}>
              <MaterialCommunityIcons name="undo" size={22} color="#4A4A4A" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextIcon}>
              <MaterialCommunityIcons name="redo" size={22} color="#B0B0B0" />
            </TouchableOpacity>
          </View>

          <View style={styles.mainPill}>
            <TouchableOpacity 
              style={[styles.contextIcon, !isEraser && styles.activeContextIcon]} 
              onPress={() => setIsEraser(false)}
            >
              <MaterialCommunityIcons name="lead-pencil" size={24} color={!isEraser ? "#000" : "#4A4A4A"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.contextIcon, isEraser && styles.activeContextIcon]} 
              onPress={() => setIsEraser(true)}
            >
              <MaterialCommunityIcons name="eraser" size={24} color={isEraser ? "#000" : "#4A4A4A"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextIcon}>
              <MaterialCommunityIcons name="marker" size={24} color="#4A4A4A" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.thicknessGroup}>
              {THICKNESSES.map((t, index) => (
                <TouchableOpacity 
                  key={t}
                  style={[styles.thicknessButton, strokeWidth === t && styles.activeThickness]}
                  onPress={() => setStrokeWidth(t)}
                >
                  <View style={[styles.dash, { height: index === 0 ? 2 : index === 1 ? 4 : 6 }]} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.colorGroup}>
              <TouchableOpacity style={styles.multiColorButton}>
                <MaterialCommunityIcons name="chevron-down-circle" size={24} color="#000" />
              </TouchableOpacity>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    selectedColor === c && !isEraser && styles.selectedColorSwatch
                  ]}
                  onPress={() => {
                    setIsEraser(false);
                    setSelectedColor(c);
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.canvasContainer}>
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={styles.scrollContent}
                onMomentumScrollEnd={(e) => {
                  const offsetY = e.nativeEvent.contentOffset.y;
                  setActivePageIndex(Math.round(offsetY / (PAGE_HEIGHT + 20))); // 20 is gap
                }}
              >
                {pages.map((p, index) => (
                  <View key={p.id} style={styles.pageWrapper}>
                    {p.template === 'ruled' && <RuledTemplate />}
                    {p.template === 'grid' && <GridTemplate />}
                    <MyModuleView 
                      ref={(el) => (canvasRefs.current[index] = el)}
                      style={styles.canvas} 
                      color={selectedColor} 
                      isEraser={isEraser} 
                      strokeWidth={strokeWidth}
                    />
                    <Text style={styles.pageNumberIndicator}>{index + 1} / {pages.length}</Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', 
  },
  topBar: {
    backgroundColor: '#2965B2', 
    zIndex: 20,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 54,
  },
  topBarSection: {
    flexDirection: 'row',
    gap: 15,
    flex: 1,
  },
  topBarCenterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarSectionRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
    flex: 1,
  },
  topBarIcon: {
    padding: 6,
  },
  activeTopBarIcon: {
    backgroundColor: '#E8F1F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#E6E8EA',
  },
  contextBarContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    gap: 15,
    zIndex: 10,
    position: 'absolute',
    width: '100%',
  },
  undoPill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  contextIcon: {
    padding: 8,
    borderRadius: 20,
  },
  activeContextIcon: {
    backgroundColor: '#DDF4FF', 
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  thicknessGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thicknessButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  activeThickness: {
    backgroundColor: '#EAEAEA',
  },
  dash: {
    width: 14,
    backgroundColor: '#000',
    borderRadius: 2,
  },
  colorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  multiColorButton: {
    padding: 2,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  selectedColorSwatch: {
    borderWidth: 2,
    borderColor: '#007AFF',
    transform: [{ scale: 1.15 }],
  },
  canvasContainer: {
    flex: 1,
    marginTop: 0,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingTop: 100, 
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20,
  },
  pageWrapper: {
    width: SCREEN_WIDTH * 0.95,
    height: PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    borderRadius: 8,
    overflow: 'hidden', 
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent', 
  },
  pageNumberIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 15,
    color: '#999',
    fontSize: 12,
    fontWeight: 'bold',
  }
});

