import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert, Platform, StatusBar as RNStatusBar, ScrollView, Dimensions, Modal, TextInput, Image, Switch, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withSpring, useAnimatedRef, scrollTo, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { io, Socket } from 'socket.io-client';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import MyModuleView from './modules/my-module/src/MyModuleView';
import DraggableOverlay from './DraggableOverlay';

const COLORS = ['#29B6F6', '#FFEE58', '#66BB6A']; // Cyan, Yellow, Green from the image
const THICKNESSES = [2, 5, 10]; // Fine, Medium, Thick
const TEMPLATES = ['blank', 'ruled', 'semi-ruled', 'narrow-ruled', 'grid', 'narrow-grid', 'more-grid', 'school', 'college'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_HEIGHT = SCREEN_HEIGHT * 0.8;

// Template Background Components
const RuledTemplate = ({ spacing = 25, color = '#D3E3FD', margin = 0 }) => (
  <View style={StyleSheet.absoluteFill}>
    {margin > 0 && <View style={{ position: 'absolute', left: margin, width: 2, height: '100%', backgroundColor: '#FF8A80' }} />}
    {Array.from({ length: Math.floor(PAGE_HEIGHT / spacing) }).map((_, i) => (
      <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: color, height: spacing, width: '100%' }} />
    ))}
  </View>
);

const GridTemplate = ({ size = 25, color = '#E8F1F9' }) => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', flexWrap: 'wrap' }]}>
    {Array.from({ length: Math.ceil((SCREEN_WIDTH / size) * (PAGE_HEIGHT / size)) }).map((_, i) => (
      <View key={i} style={{ borderWidth: 0.5, borderColor: color, width: size, height: size }} />
    ))}
  </View>
);

const SchoolTemplate = () => (
  <View style={StyleSheet.absoluteFill}>
    <View style={{ position: 'absolute', left: 60, width: 2, height: '100%', backgroundColor: '#FF8A80' }} />
    {Array.from({ length: Math.floor(PAGE_HEIGHT / 30) }).map((_, i) => (
      <View key={i} style={{ height: 30, width: '100%', borderBottomWidth: 1, borderBottomColor: '#64B5F6' }}>
        {i % 2 !== 0 && <View style={{ position: 'absolute', top: 15, width: '100%', borderBottomWidth: 1, borderBottomColor: '#64B5F6', borderStyle: 'dashed' }} />}
      </View>
    ))}
  </View>
);

const CustomSplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const textWidth = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withSpring(1, { damping: 12 });
    
    // Increased target width to 280 to ensure text fully fits
    textWidth.value = withDelay(800, withTiming(280, { duration: 700, easing: Easing.out(Easing.exp) }));

    containerOpacity.value = withDelay(2500, withTiming(0, { duration: 500 }, (finished) => {
      if (finished) {
        runOnJS(onFinish)();
      }
    }));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }]
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    width: textWidth.value
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value
  }));

  const LOGO_SIZE = 80;
  
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }, containerAnimatedStyle]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        
        <Animated.View style={[{ zIndex: 2 }, logoAnimatedStyle]}>
          <Image 
            source={require('./assets/CrossNotes.png')} 
            style={{ width: LOGO_SIZE, height: LOGO_SIZE }} 
            resizeMode="contain" 
          />
        </Animated.View>

        <Animated.View style={[{ overflow: 'hidden', height: LOGO_SIZE, justifyContent: 'center', zIndex: 1 }, textAnimatedStyle]}>
          <View style={{ width: 300, paddingLeft: 10 }}>
            <Text numberOfLines={1} style={{ fontSize: 44, fontWeight: '800', includeFontPadding: false }}>
              <Text style={{ color: '#1B234B' }}>Cross</Text>
              <Text style={{ color: '#6A4DFF' }}>Notes</Text>
            </Text>
          </View>
        </Animated.View>

      </View>
    </Animated.View>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [penType, setPenType] = useState('pen'); // 'pen', 'pencil', 'fountain', 'brush'
  const [strokeWidth, setStrokeWidth] = useState(THICKNESSES[1]);
  const [pages, setPages] = useState([{ id: Date.now().toString(), template: 'blank', overlays: [] as any[] }]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  
  // Transfer & Context State
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [macIpAddress, setMacIpAddress] = useState('');
  const [isBluetoothMode, setIsBluetoothMode] = useState(false);
  
  // Menus
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, absX: number, absY: number } | null>(null);
  const [overlayMenu, setOverlayMenu] = useState<{ id: string, pageIndex: number, absX: number, absY: number } | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const activePageRef = useRef(activePageIndex);
  activePageRef.current = activePageIndex;
  
  const canvasRefs = useRef<any[]>([]);

  // Socket Connection Effect
  useEffect(() => {
    if (macIpAddress && !isBluetoothMode) {
      if (socketRef.current) socketRef.current.disconnect();
      
      const socket = io(`http://${macIpAddress}:4000`);
      socketRef.current = socket;

      socket.on('connect', () => {
        Alert.alert('Connected!', 'Successfully connected to Mac Transfer Station.');
      });

      socket.on('transfer-item', (data: { type: string, content: string }) => {
        setPages((prev) => {
          const newPages = [...prev];
          const currPage = { ...newPages[activePageRef.current] };
          currPage.overlays = [...(currPage.overlays || []), { 
            id: Date.now().toString(),
            type: data.type,
            content: data.type === 'image' && !data.content.startsWith('data:image') ? `data:image/png;base64,${data.content}` : data.content,
            x: Math.random() * (SCREEN_WIDTH * 0.5),
            y: Math.random() * (PAGE_HEIGHT * 0.5),
            scale: 1,
            rotation: 0
          }];
          newPages[activePageRef.current] = currPage;
          return newPages;
        });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [macIpAddress, isBluetoothMode]);

  // Gesture Values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const [isPullingToAdd, setIsPullingToAdd] = useState(false);

  const handleLongPress = (x: number, y: number, absX: number, absY: number) => {
    if (selectedOverlayId) {
      setSelectedOverlayId(null);
    } else {
      setContextMenu({ x, y, absX, absY });
    }
  };

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart((e) => {
      runOnJS(handleLongPress)(e.x, e.y, e.absoluteX, e.absoluteY);
    });

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      if (selectedOverlayId) {
        runOnJS(setSelectedOverlayId)(null);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        savedTranslateX.value = 0;
      }
      savedScale.value = scale.value;
    });

  const isPullingValue = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      // Horizontal pan
      translateX.value = savedTranslateX.value + e.translationX;
      
      // Vertical pan using translateY matrix transform (crash-free!)
      const maxScrollY = Math.max(0, contentHeight.value - SCREEN_HEIGHT);
      let targetTranslateY = savedTranslateY.value + e.translationY;
      
      if (targetTranslateY > 0) {
        targetTranslateY = targetTranslateY * 0.3; // Rubber-band top
      } else if (targetTranslateY < -maxScrollY) {
        const overscroll = targetTranslateY - (-maxScrollY);
        targetTranslateY = -maxScrollY + (overscroll * 0.3); // Rubber-band bottom
      }
      
      translateY.value = targetTranslateY;
      
      const overscrollAmt = (-targetTranslateY) - maxScrollY;
      if (overscrollAmt > 60) {
        if (!isPullingValue.value) {
          isPullingValue.value = true;
          runOnJS(setIsPullingToAdd)(true);
        }
      } else {
        if (isPullingValue.value) {
          isPullingValue.value = false;
          runOnJS(setIsPullingToAdd)(false);
        }
      }
    })
    .onEnd((e) => {
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
      } else {
        const maxTranslateX = (SCREEN_WIDTH * scale.value - SCREEN_WIDTH) / 2;
        if (translateX.value > maxTranslateX) {
          translateX.value = withSpring(maxTranslateX);
        } else if (translateX.value < -maxTranslateX) {
          translateX.value = withSpring(-maxTranslateX);
        }
      }
      savedTranslateX.value = translateX.value;
      
      // Vertical snap and pull-to-add logic
      const maxScrollY = Math.max(0, contentHeight.value - SCREEN_HEIGHT);
      let targetTranslateY = savedTranslateY.value + e.translationY;
      let shouldSnap = true;
      
      if (targetTranslateY < -maxScrollY - 60) {
        runOnJS(handleAddPage)();
        shouldSnap = false; 
        targetTranslateY = -maxScrollY - PAGE_HEIGHT - 20; 
      } else {
        if (targetTranslateY > 0) {
          targetTranslateY = 0;
        } else if (targetTranslateY < -maxScrollY) {
          targetTranslateY = -maxScrollY;
        }
      }
      
      savedTranslateY.value = targetTranslateY;
      
      if (shouldSnap) {
        translateY.value = withSpring(targetTranslateY);
      } else {
        translateY.value = targetTranslateY; // Fast forward instantly
      }
      runOnJS(setIsPullingToAdd)(false);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, longPressGesture, tapGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transformOrigin: 'top',
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
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
    const lastTemplate = pages[pages.length - 1].template;
    setPages([...pages, { id: Date.now().toString(), template: lastTemplate, overlays: [] }]);
    setActivePageIndex(pages.length);
    
    // Safely jump to the newly added page without using runOnUI or setTimeout
    const newMaxScroll = Math.max(0, contentHeight.value - SCREEN_HEIGHT + PAGE_HEIGHT + 20);
    translateY.value = withSpring(-newMaxScroll);
    savedTranslateY.value = -newMaxScroll;
  };

  const handleChangeTemplate = (templateName: string) => {
    const newPages = [...pages];
    newPages[activePageIndex].template = templateName;
    setPages(newPages);
    setTemplateModalVisible(false);
  };

  const handleAddImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setPages((prev) => {
        const newPages = [...prev];
        const currPage = { ...newPages[activePageRef.current] };
        currPage.overlays = [...(currPage.overlays || []), {
          id: Date.now().toString(),
          type: 'image',
          content: `data:image/png;base64,${asset.base64}`,
          x: 150,
          y: 200,
          scale: 1,
          rotation: 0
        }];
        newPages[activePageRef.current] = currPage;
        return newPages;
      });
    }
  };

  const handleAddText = () => {
    setPages((prev) => {
      const newPages = [...prev];
      const currPage = { ...newPages[activePageRef.current] };
      currPage.overlays = [...(currPage.overlays || []), {
        id: Date.now().toString(),
        type: 'text',
        content: 'Double tap to edit text',
        x: 150,
        y: 200,
        scale: 1,
        rotation: 0
      }];
      newPages[activePageRef.current] = currPage;
      return newPages;
    });
  };

  const handleClearPage = () => {
    Alert.alert('Clear Page', 'Are you sure you want to clear all ink and images from this page?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        canvasRefs.current[activePageIndex]?.clear?.();
        setPages((prev) => {
          const newPages = [...prev];
          newPages[activePageIndex].overlays = [];
          return newPages;
        });
      }}
    ]);
  };

  const handlePaste = async () => {
    if (!contextMenu) return;
    try {
      const hasImage = await Clipboard.hasImageAsync();
      let newItem = null;
      const pageY = contextMenu.y + scrollY.value;
      
      if (hasImage) {
        const image = await Clipboard.getImageAsync({ format: 'png' });
        if (image) {
          newItem = { 
            type: 'image', 
            content: `data:image/png;base64,${image.data}`, 
            id: Date.now().toString(), 
            x: contextMenu.x, 
            y: pageY,
            scale: 1,
            rotation: 0
          };
        }
      } else {
        const text = await Clipboard.getStringAsync();
        if (text) {
          newItem = { 
            type: 'text', 
            content: text, 
            id: Date.now().toString(), 
            x: contextMenu.x, 
            y: pageY,
            scale: 1,
            rotation: 0
          };
        }
      }
      
      if (newItem) {
        setPages((prev) => {
          const newPages = [...prev];
          const currPage = { ...newPages[activePageRef.current] };
          currPage.overlays = [...(currPage.overlays || []), newItem];
          newPages[activePageRef.current] = currPage;
          return newPages;
        });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Paste Error', 'Could not read from clipboard.');
    }
    setContextMenu(null);
  };

  const handleOverlayUpdate = (pageIndex: number, id: string, updates: any) => {
    setPages((prev) => {
      const newPages = [...prev];
      const currPage = { ...newPages[pageIndex] };
      const overlays = [...(currPage.overlays || [])];
      const idx = overlays.findIndex(o => o.id === id);
      if (idx !== -1) {
        overlays[idx] = { ...overlays[idx], ...updates };
        currPage.overlays = overlays;
        newPages[pageIndex] = currPage;
      }
      return newPages;
    });
  };

  const handleCopyOverlay = async () => {
    if (!overlayMenu) return;
    const page = pages[overlayMenu.pageIndex];
    const overlay = page.overlays.find(o => o.id === overlayMenu.id);
    if (overlay) {
      if (overlay.type === 'text') {
        await Clipboard.setStringAsync(overlay.content);
      } else if (overlay.type === 'image') {
        const base64Data = overlay.content.replace('data:image/png;base64,', '').replace('data:image/jpeg;base64,', '');
        await Clipboard.setImageAsync(base64Data);
      }
    }
    setOverlayMenu(null);
    setSelectedOverlayId(null);
  };

  const handleDeleteOverlay = () => {
    if (!overlayMenu) return;
    setPages((prev) => {
      const newPages = [...prev];
      const currPage = { ...newPages[overlayMenu.pageIndex] };
      currPage.overlays = currPage.overlays.filter((o: any) => o.id !== overlayMenu.id);
      newPages[overlayMenu.pageIndex] = currPage;
      return newPages;
    });
    setOverlayMenu(null);
    setSelectedOverlayId(null);
  };

  // Pull-to-add logic

  return (
    <GestureHandlerRootView style={styles.container}>
      {showSplash && <CustomSplashScreen onFinish={() => setShowSplash(false)} />}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.topBarSection}>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="dock-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialCommunityIcons name="magnify" size={24} color="#FFF" />
            </TouchableOpacity>
            {/* Sync / Transfer Button */}
            <TouchableOpacity style={styles.topBarIcon} onPress={() => setTransferModalVisible(true)}>
              <MaterialCommunityIcons name={isBluetoothMode ? "bluetooth-transfer" : "wifi-sync"} size={24} color={socketRef.current?.connected ? "#4CAF50" : "#FFF"} />
            </TouchableOpacity>
          </View>

          <View style={styles.topBarCenterSection}>
            <TouchableOpacity style={styles.topBarIcon} onPress={() => setIsEraser(false)}>
              <MaterialCommunityIcons name="pencil" size={24} color={!isEraser ? "#2965B2" : "#FFF"} style={!isEraser ? styles.activeIconWrap : {}} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={() => setIsEraser(true)}>
              <MaterialCommunityIcons name="eraser" size={24} color={isEraser ? "#2965B2" : "#FFF"} style={isEraser ? styles.activeIconWrap : {}} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleAddText}>
              <MaterialCommunityIcons name="format-text" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleAddImage}>
              <MaterialCommunityIcons name="image-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleClearPage}>
              <MaterialCommunityIcons name="delete-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.topBarSectionRight}>
            <TouchableOpacity style={styles.topBarIcon} onPress={() => setTemplateModalVisible(true)}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleAddPage}>
              <MaterialCommunityIcons name="file-document-plus-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarIcon} onPress={handleSave}>
              <MaterialCommunityIcons name="export-variant" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.contentArea}>
        
        {/* Undo/Redo Pill moved to Left Upper Corner */}
        <View style={styles.undoPill}>
          <TouchableOpacity style={styles.contextIconSmall} onPress={handleUndo}>
            <MaterialCommunityIcons name="undo" size={18} color="#4A4A4A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextIconSmall}>
            <MaterialCommunityIcons name="redo" size={18} color="#B0B0B0" />
          </TouchableOpacity>
        </View>

        <View style={styles.contextBarContainer}>
          <View style={styles.mainPill}>
            <TouchableOpacity 
              style={[styles.contextIcon, !isEraser && penType === 'pen' && styles.activeContextIcon]} 
              onPress={() => { setIsEraser(false); setPenType('pen'); }}
            >
              <MaterialCommunityIcons name="pen" size={24} color={!isEraser && penType === 'pen' ? "#000" : "#4A4A4A"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.contextIcon, !isEraser && penType === 'pencil' && styles.activeContextIcon]} 
              onPress={() => { setIsEraser(false); setPenType('pencil'); }}
            >
              <MaterialCommunityIcons name="lead-pencil" size={24} color={!isEraser && penType === 'pencil' ? "#000" : "#4A4A4A"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.contextIcon, !isEraser && penType === 'fountain' && styles.activeContextIcon]} 
              onPress={() => { setIsEraser(false); setPenType('fountain'); }}
            >
              <MaterialCommunityIcons name="fountain-pen-tip" size={24} color={!isEraser && penType === 'fountain' ? "#000" : "#4A4A4A"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.contextIcon, !isEraser && penType === 'brush' && styles.activeContextIcon]} 
              onPress={() => { setIsEraser(false); setPenType('brush'); }}
            >
              <MaterialCommunityIcons name="brush" size={24} color={!isEraser && penType === 'brush' ? "#000" : "#4A4A4A"} />
            </TouchableOpacity>
            
            <View style={{ width: 1, height: 24, backgroundColor: '#E0E0E0', marginHorizontal: 8 }} />

            <TouchableOpacity 
              style={[styles.contextIcon, isEraser && styles.activeContextIcon]} 
              onPress={() => setIsEraser(true)}
            >
              <MaterialCommunityIcons name="eraser" size={24} color={isEraser ? "#000" : "#4A4A4A"} />
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
                scrollEnabled={false}
                contentContainerStyle={styles.scrollContent}
                onContentSizeChange={(w, h) => {
                  contentHeight.value = h;
                }}
              >
                {pages.map((p, index) => (
                  <View key={p.id} style={styles.pageWrapper}>
                    {p.template === 'ruled' && <RuledTemplate spacing={40} />}
                    {p.template === 'semi-ruled' && <RuledTemplate spacing={30} />}
                    {p.template === 'narrow-ruled' && <RuledTemplate spacing={20} />}
                    {p.template === 'grid' && <GridTemplate size={40} />}
                    {p.template === 'narrow-grid' && <GridTemplate size={20} />}
                    {p.template === 'more-grid' && <GridTemplate size={10} />}
                    {p.template === 'school' && <SchoolTemplate />}
                    {p.template === 'college' && <RuledTemplate spacing={35} margin={60} />}
                    
                    {/* Render Overlays Layer (Text & Images from Mac/Clipboard) */}
                    <View style={styles.overlayContainer} pointerEvents="box-none">
                      {p.overlays?.map((overlay: any) => (
                        <DraggableOverlay
                          key={overlay.id}
                          overlay={overlay}
                          isSelected={selectedOverlayId === overlay.id}
                          onSelect={() => setSelectedOverlayId(overlay.id)}
                          onUpdate={(updates) => handleOverlayUpdate(index, overlay.id, updates)}
                          onAction={(action, absX, absY) => {
                            if (action === 'menu') {
                              setOverlayMenu({ id: overlay.id, pageIndex: index, absX, absY });
                            }
                          }}
                        />
                      ))}
                    </View>

                    <MyModuleView 
                      ref={(el) => (canvasRefs.current[index] = el)}
                      style={styles.canvas} 
                      color={selectedColor} 
                      isEraser={isEraser} 
                      strokeWidth={strokeWidth}
                      penType={penType}
                    />
                    <Text style={styles.pageNumberIndicator}>{index + 1} / {pages.length}</Text>
                  </View>
                ))}
                
                {/* Pull to Add Footer */}
                <View style={styles.pullToAddFooter}>
                  <MaterialCommunityIcons 
                    name={isPullingToAdd ? "plus-circle" : "plus-circle-outline"} 
                    size={28} 
                    color={isPullingToAdd ? "#2965B2" : "#999"} 
                  />
                  <Text style={[styles.pullToAddText, isPullingToAdd && styles.pullToAddTextActive]}>
                    {isPullingToAdd ? "Release to add page" : "Pull up to add page"}
                  </Text>
                </View>
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>

      {/* Context Menu (Page Long Press - Paste) */}
      {contextMenu && (
        <Modal transparent visible animationType="fade">
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setContextMenu(null)}
          >
            <View style={[styles.contextMenuBubble, { top: contextMenu.absY - 60, left: contextMenu.absX - 40 }]}>
              <TouchableOpacity style={styles.contextMenuBtn} onPress={handlePaste}>
                <MaterialCommunityIcons name="content-paste" size={20} color="#2965B2" />
                <Text style={styles.contextMenuText}>Paste</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Overlay Context Menu (Copy / Delete) */}
      {overlayMenu && (
        <Modal transparent visible animationType="fade">
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setOverlayMenu(null)}
          >
            <View style={[styles.contextMenuBubble, { top: overlayMenu.absY - 60, left: overlayMenu.absX - 40, paddingHorizontal: 5 }]}>
              <TouchableOpacity style={styles.contextMenuBtn} onPress={handleCopyOverlay}>
                <MaterialCommunityIcons name="content-copy" size={20} color="#2965B2" />
                <Text style={styles.contextMenuText}>Copy</Text>
              </TouchableOpacity>
              <View style={{ width: 1, backgroundColor: '#EEE', marginVertical: 8 }} />
              <TouchableOpacity style={styles.contextMenuBtn} onPress={handleDeleteOverlay}>
                <MaterialCommunityIcons name="delete-outline" size={20} color="#E53935" />
                <Text style={[styles.contextMenuText, { color: '#E53935' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Template Selection Modal */}
      <Modal visible={templateModalVisible} transparent animationType="fade" onRequestClose={() => setTemplateModalVisible(false)}>
        <TouchableOpacity style={[styles.modalOverlay, { zIndex: 999, elevation: 999 }]} activeOpacity={1} onPress={() => setTemplateModalVisible(false)}>
          <View style={[styles.modalContent, { width: '80%', height: '70%', alignItems: 'center' }]}>
            <Text style={styles.modalTitle}>Choose Template</Text>
            <FlatList
              data={TEMPLATES}
              numColumns={3}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.templateThumb, pages[activePageIndex]?.template === item && styles.activeTemplateThumb]}
                  onPress={() => handleChangeTemplate(item)}
                >
                  <View style={styles.templateThumbInner}>
                    {item === 'ruled' && <RuledTemplate spacing={8} />}
                    {item === 'semi-ruled' && <RuledTemplate spacing={6} />}
                    {item === 'narrow-ruled' && <RuledTemplate spacing={4} />}
                    {item === 'grid' && <GridTemplate size={10} />}
                    {item === 'narrow-grid' && <GridTemplate size={6} />}
                    {item === 'more-grid' && <GridTemplate size={4} />}
                    {item === 'school' && <SchoolTemplate />}
                    {item === 'college' && <RuledTemplate spacing={8} margin={15} />}
                  </View>
                  <Text style={styles.templateThumbLabel}>{item.replace('-', ' ').toUpperCase()}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transfer Connection Modal */}
      <Modal visible={transferModalVisible} transparent animationType="slide" onRequestClose={() => setTransferModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Connect to Mac Transfer</Text>
            
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Connection Type:</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <Text style={{color: isBluetoothMode ? '#aaa' : '#2965B2', fontWeight: 'bold'}}>WiFi</Text>
                <Switch 
                  value={isBluetoothMode} 
                  onValueChange={(val) => {
                    setIsBluetoothMode(val);
                    if(val) Alert.alert("Bluetooth Pending", "Bluetooth transfer is in beta, WiFi recommended.");
                  }} 
                />
                <Text style={{color: isBluetoothMode ? '#2965B2' : '#aaa', fontWeight: 'bold'}}>Bluetooth</Text>
              </View>
            </View>

            {!isBluetoothMode ? (
              <TextInput 
                style={styles.input} 
                placeholder="Mac IP Address (e.g. 192.168.1.10)" 
                value={macIpAddress}
                onChangeText={setMacIpAddress}
                keyboardType="numeric"
              />
            ) : (
              <Text style={{color: '#666', marginBottom: 15, textAlign: 'center'}}>Searching for Bluetooth devices...</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.btnTextSecondary}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.btnTextPrimary}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
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
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 45,
    zIndex: 10,
    elevation: 10,
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
  activeIconWrap: {
    backgroundColor: '#E8F1F9',
    padding: 6,
    borderRadius: 8,
    overflow: 'hidden'
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#E8F1F9',
  },
  undoPill: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 20,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  contextIconSmall: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextBarContainer: {
    position: 'absolute',
    top: 15,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  mainPill: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  contextIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeContextIcon: {
    backgroundColor: '#F0F4F8',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  thicknessGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thicknessButton: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeThickness: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
  },
  dash: {
    width: 18,
    backgroundColor: '#4A4A4A',
    borderRadius: 2,
  },
  colorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiColorButton: {
    marginRight: 8,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 4,
  },
  selectedColorSwatch: {
    borderWidth: 2,
    borderColor: '#000',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#E8F1F9',
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
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent', 
    zIndex: 10,
  },
  pageNumberIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 15,
    color: '#999',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: 350,
    padding: 25,
    borderRadius: 12,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333'
  },
  input: {
    width: '100%',
    height: 45,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%'
  },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#EEE'
  },
  btnTextSecondary: {
    color: '#333',
    fontWeight: 'bold'
  },
  btnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2965B2'
  },
  btnTextPrimary: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  // Context Menu
  contextMenuBubble: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    flexDirection: 'row',
  },
  contextMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  contextMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  // Templates
  templateThumb: {
    margin: 10,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeTemplateThumb: {
    borderColor: '#2965B2',
    backgroundColor: '#E8F1F9',
  },
  templateThumbInner: {
    width: 80,
    height: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateThumbLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
  },
  // Pull to Add Footer
  pullToAddFooter: {
    position: 'absolute',
    bottom: -100,
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  pullToAddText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
  pullToAddTextActive: {
    color: '#2965B2',
  }
});

