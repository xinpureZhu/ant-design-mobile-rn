import React from 'react';
import { Animated, Dimensions, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, ViewPagerAndroid } from 'react-native';
import { WithTheme, WithThemeStyles } from '../style';
import View from '../view';
import { DefaultTabBar } from './DefaultTabBar';
import { PropsType, TabData } from './PropsType';
import TabsStyles, { TabsStyle } from './style/tabs';

export interface StateType {
  currentTab: number;
  scrollX: Animated.Value;
  scrollValue: Animated.Value;
  containerWidth: number;
}

let instanceId: number = 0;
export interface TabsProps extends PropsType, WithThemeStyles<TabsStyle> {}
export class Tabs extends React.PureComponent<TabsProps, StateType> {
  static defaultProps: PropsType = {
    tabBarPosition: 'top',
    initialPage: 0,
    swipeable: true,
    animated: true,
    prerenderingSiblingsNumber: 1,
    tabs: [],
    destroyInactiveTab: false,
    usePaged: true,
    tabDirection: 'horizontal',
    distanceToChangeTab: 0.3,
    style: {},
    tabBarContentViewStyle: {},
  };
  static DefaultTabBar = DefaultTabBar;

  scrollView: { _component: ScrollView };
  viewPager: ViewPagerAndroid | null;

  protected instanceId: number;
  protected prevCurrentTab: number;
  protected tabCache: { [index: number]: React.ReactNode } = {};

  /** compatible for different between react and preact in `setState`. */
  private nextCurrentTab: number;

  constructor(props: PropsType) {
    super(props);

    const width = Dimensions.get('window').width;
    const pageIndex = this.getTabIndex(props);
    this.state = {
      currentTab: pageIndex,
      scrollX: new Animated.Value(pageIndex * width),
      scrollValue: new Animated.Value(pageIndex),
      containerWidth: width,
    };
    this.nextCurrentTab = this.state.currentTab;
    this.instanceId = instanceId++;
  }

  componentDidMount() {
    this.prevCurrentTab = this.state.currentTab;
    this.state.scrollX.addListener(({ value }) => {
      const scrollValue = value / this.state.containerWidth;
      this.state.scrollValue.setValue(scrollValue);
    });
  }

  setScrollView = (sv: any) => {
    this.scrollView = sv;
    this.scrollTo(this.state.currentTab);
  };

  renderContent = (getSubElements = this.getSubElements()) => {
    const {
      tabs,
      usePaged,
      destroyInactiveTab,
      keyboardShouldPersistTaps,
      tabBarContentViewStyle,
    } = this.props;
    const { currentTab = 0, containerWidth = 0 } = this.state;
    const content = tabs.map((tab, index) => {
      const key = tab.key || `tab_${index}`;

      // update tab cache
      if (this.shouldRenderTab(index)) {
        this.tabCache[index] = this.getSubElement(tab, index, getSubElements);
      } else if (destroyInactiveTab) {
        this.tabCache[index] = undefined;
      }

      return (
        <View
          key={key}
          // active={currentTab === index}
          style={{ width: containerWidth }}
        >
          {this.tabCache[index]}
        </View>
      );
    });
    if (Platform.OS === 'android') {
      return (
        <ViewPagerAndroid
          key="$content"
          keyboardDismissMode="on-drag"
          initialPage={currentTab}
          scrollEnabled={this.props.swipeable || usePaged}
          onPageScroll={e => {
            this.state.scrollX.setValue(
              e.nativeEvent.position * this.state.containerWidth,
            );
          }}
          style={{ flex: 1, ...tabBarContentViewStyle as object }}
          onPageSelected={e => {
            const index = e.nativeEvent.position;
            this.setState(
              {
                currentTab: index,
              },
              () => {
                // tslint:disable-next-line:no-unused-expression
                this.props.onChange && this.props.onChange(tabs[index], index);
              },
            );
            this.nextCurrentTab = index;
          }}
          ref={ref => (this.viewPager = ref)}
        >
          {content}
        </ViewPagerAndroid>
      );
    }
    return (
      <Animated.ScrollView
        key="$content"
        horizontal
        pagingEnabled={usePaged}
        automaticallyAdjustContentInsets={false}
        ref={this.setScrollView}
        onScroll={Animated.event(
          [
            {
              nativeEvent: {
                contentOffset: { x: this.state.scrollX },
              },
            },
          ],
          { useNativeDriver: true }, // <-- Add this
        )}
        onMomentumScrollEnd={this.onMomentumScrollEnd}
        scrollEventThrottle={16}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={this.props.swipeable}
        directionalLockEnabled
        alwaysBounceVertical={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        style={{ ...tabBarContentViewStyle as object }}
      >
        {content}
      </Animated.ScrollView>
    );
  };

  onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = this.getOffsetIndex(offsetX, this.state.containerWidth);
    if (this.state.currentTab !== page) {
      this.goToTab(page);
    }
  };

  handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    requestAnimationFrame(() => {
      this.scrollTo(this.state.currentTab, false);
    });
    if (Math.round(width) !== Math.round(this.state.containerWidth)) {
      this.setState({ containerWidth: width });
    }
  };

  scrollTo = (index: number, animated = true) => {
    if (Platform.OS === 'android') {
      if (this.viewPager) {
        if (animated) {
          this.viewPager.setPage(index);
        } else {
          this.viewPager.setPageWithoutAnimation(index);
        }
        return;
      }
    }
    const { containerWidth } = this.state;
    if (containerWidth) {
      const offset = index * containerWidth;
      if (this.scrollView && this.scrollView._component) {
        const { scrollTo } = this.scrollView._component;
        // tslint:disable-next-line:no-unused-expression
        scrollTo && scrollTo.call(this.scrollView._component, { x: offset, animated });
      }
    }
  };

  render() {
    const {
      tabBarPosition,
      noRenderContent,
      keyboardShouldPersistTaps,
    } = this.props;
    const { scrollX, scrollValue, containerWidth } = this.state;
    // let overlayTabs = (this.props.tabBarPosition === 'overlayTop' || this.props.tabBarPosition === 'overlayBottom');
    const overlayTabs = false;

    const tabBarProps = {
      ...this.getTabBarBaseProps(),

      keyboardShouldPersistTaps,
      scrollX: scrollX,
      scrollValue: scrollValue,
      containerWidth: containerWidth,
    };

    if (overlayTabs) {
      // tabBarProps.style = {
      //     position: 'absolute',
      //     left: 0,
      //     right: 0,
      //     [this.props.tabBarPosition === 'overlayTop' ? 'top' : 'bottom']: 0,
      // };
    }
    return (
      <WithTheme styles={this.props.styles} themeStyles={TabsStyles}>
        {styles => {
          const content = [
            <View
              key="$tabbar"
              style={
                tabBarPosition === 'top'
                  ? styles.topTabBarSplitLine
                  : styles.bottomTabBarSplitLine
              }
            >
              {this.renderTabBar(tabBarProps, DefaultTabBar)}
            </View>,
            !noRenderContent && this.renderContent(),
          ];

          return (
            <View
              style={[styles.container, this.props.style]}
              onLayout={this.handleLayout}
            >
              {tabBarPosition === 'top' ? content : content.reverse()}
            </View>
          );
        }}
      </WithTheme>
    );
  }
  getTabIndex(props: PropsType) {
    const { page, initialPage, tabs } = props;
    const param = (page !== undefined ? page : initialPage) || 0;

    let index = 0;
    if (typeof (param as any) === 'string') {
      tabs.forEach((t, i) => {
        if (t.key === param) {
          index = i;
        }
      });
    } else {
      index = (param as number) || 0;
    }
    return index < 0 ? 0 : index;
  }

  isTabVertical = (direction = this.props.tabDirection) =>
    direction === 'vertical';

  shouldRenderTab = (idx: number) => {
    const { prerenderingSiblingsNumber = 0 } = this.props;
    const { currentTab = 0 } = this.state;

    return (
      currentTab - prerenderingSiblingsNumber <= idx &&
      idx <= currentTab + prerenderingSiblingsNumber
    );
  };

  componentWillReceiveProps(nextProps: PropsType) {
    if (this.props.page !== nextProps.page && nextProps.page !== undefined) {
      this.goToTab(this.getTabIndex(nextProps), true);
    }
  }

  componentDidUpdate() {
    this.prevCurrentTab = this.state.currentTab;
  }

  getOffsetIndex = (
    current: number,
    width: number,
    threshold = this.props.distanceToChangeTab || 0,
  ) => {
    const ratio = Math.abs(current / width);
    const direction = ratio > this.state.currentTab ? '<' : '>';
    const index = Math.floor(ratio);
    switch (direction) {
      case '<':
        return ratio - index > threshold ? index + 1 : index;
      case '>':
        return 1 - ratio + index > threshold ? index : index + 1;
      default:
        return Math.round(ratio);
    }
  };

  goToTab(index: number, force = false, newState: any = {}) {
    if (!force && this.nextCurrentTab === index) {
      return false;
    }
    this.nextCurrentTab = index;
    const { tabs, onChange } = this.props as PropsType;
    if (index >= 0 && index < tabs.length) {
      if (!force) {
        // tslint:disable-next-line:no-unused-expression
        onChange && onChange(tabs[index], index);
      }
      this.setState(
        {
          currentTab: index,
          ...newState,
        },
        () => {
          requestAnimationFrame(() => {
            this.scrollTo(this.state.currentTab, this.props.animated);
          });
        },
      );
    }

    return true;
  }

  tabClickGoToTab(index: number) {
    this.goToTab(index);
  }

  getTabBarBaseProps() {
    const { currentTab } = this.state;

    const {
      animated,
      onTabClick,
      tabBarActiveTextColor,
      tabBarBackgroundColor,
      tabBarInactiveTextColor,
      tabBarPosition,
      tabBarTextStyle,
      tabBarUnderlineStyle,
      renderTab,
      renderUnderline,
      tabs,
    } = this.props;
    return {
      activeTab: currentTab,
      animated: !!animated,
      goToTab: this.tabClickGoToTab.bind(this),
      onTabClick,
      tabBarActiveTextColor,
      tabBarBackgroundColor,
      tabBarInactiveTextColor,
      tabBarPosition,
      tabBarTextStyle,
      tabBarUnderlineStyle,
      renderTab,
      renderUnderline,
      tabs,
      instanceId: this.instanceId,
    };
  }

  // tslint:disable-next-line:no-shadowed-variable
  renderTabBar(tabBarProps: any, DefaultTabBar: React.ComponentClass) {
    const { renderTabBar } = this.props;
    if (renderTabBar === false) {
      return null;
    } else if (renderTabBar) {
      return renderTabBar(tabBarProps);
    } else {
      return <DefaultTabBar {...tabBarProps} />;
    }
  }

  getSubElements = () => {
    const { children } = this.props;
    const subElements: { [key: string]: React.ReactNode } = {};

    return (defaultPrefix: string = '$i$-', allPrefix: string = '$ALL$') => {
      if (Array.isArray(children)) {
        children.forEach((child: any, index) => {
          if (child.key) {
            subElements[child.key] = child;
          }
          subElements[`${defaultPrefix}${index}`] = child;
        });
      } else if (children) {
        subElements[allPrefix] = children;
      }
      return subElements;
    };
  };

  getSubElement(
    tab: TabData,
    index: number,
    subElements: (
      defaultPrefix: string,
      allPrefix: string,
    ) => { [key: string]: any },
    defaultPrefix: string = '$i$-',
    allPrefix: string = '$ALL$',
  ) {
    const key = tab.key || `${defaultPrefix}${index}`;
    const elements = subElements(defaultPrefix, allPrefix);
    let component = elements[key] || elements[allPrefix];
    if (component instanceof Function) {
      component = component(tab, index);
    }
    return component || null;
  }
}
