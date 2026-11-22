#import "CarPlaySceneDelegate.h"

#import <CarPlay/CarPlay.h>
#import <GoogleNavigation/GoogleNavigation.h>
#import <MapKit/MapKit.h>
#import <ReactNativeGoogleMapsNavigation/NavModule.h>

@interface CamAlertCarMapController : UIViewController
@property(nonatomic, copy) void (^styleChanged)(void);
@end

@implementation CamAlertCarMapController
- (void)traitCollectionDidChange:(UITraitCollection *)previousTraitCollection
{
  [super traitCollectionDidChange:previousTraitCollection];
  if (self.traitCollection.userInterfaceStyle != previousTraitCollection.userInterfaceStyle) {
    if (self.styleChanged) self.styleChanged();
  }
}
@end

@interface CarPlaySceneDelegate () <CPTemplateApplicationSceneDelegate, CPMapTemplateDelegate, GMSNavigatorListener>
@property(nonatomic, strong) CPInterfaceController *interfaceController;
@property(nonatomic, strong) CPWindow *carWindow;
@property(nonatomic, strong) CPMapTemplate *mapTemplate;
@property(nonatomic, strong) GMSMapView *mapView;
@property(nonatomic, strong) CamAlertCarMapController *mapController;
@property(nonatomic, strong) GMSNavigationSession *attachedSession;
@property(nonatomic, weak) GMSNavigator *attachedNavigator;
@property(nonatomic, strong) CPTrip *trip;
@property(nonatomic, strong) CPNavigationSession *navigationSession;
@property(nonatomic, copy) NSString *shownInstruction;
@property(nonatomic, strong) NSTimer *attachTimer;
@property(nonatomic, assign) BOOL carConnected;
@end

@implementation CarPlaySceneDelegate

static CarPlaySceneDelegate *CamAlertActiveCarPlay;

+ (void)presentAlertTitle:(NSString *)title subtitle:(NSString *)subtitle
{
  NSString *heading = [title stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  if (heading.length == 0 || CamAlertActiveCarPlay == nil) return;
  [CamAlertActiveCarPlay presentAlertTitle:heading subtitle:subtitle ?: @""];
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
   didConnectInterfaceController:(CPInterfaceController *)interfaceController
                        toWindow:(CPWindow *)window
{
  self.interfaceController = interfaceController;
  self.carWindow = window;
  self.carConnected = YES;
  CamAlertActiveCarPlay = self;

  self.mapTemplate = [[CPMapTemplate alloc] init];
  self.mapTemplate.mapDelegate = self;
  self.mapTemplate.mapButtons = [self mapButtons];
  [interfaceController setRootTemplate:self.mapTemplate animated:NO completion:nil];

  self.mapController = [[CamAlertCarMapController alloc] init];
  __weak CarPlaySceneDelegate *weakSelf = self;
  self.mapController.styleChanged = ^{
    [weakSelf applyCarStyle];
  };
  window.rootViewController = self.mapController;
  [window makeKeyAndVisible];

  GMSMapViewOptions *options = [[GMSMapViewOptions alloc] init];
  options.screen = window.screen;
  options.frame = window.bounds;
  self.mapView = [[GMSMapView alloc] initWithOptions:options];
  self.mapView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  self.mapView.settings.navigationHeaderEnabled = NO;
  self.mapView.settings.navigationFooterEnabled = NO;
  self.mapView.settings.compassButton = NO;
  self.mapView.settings.recenterButtonEnabled = NO;
  self.mapView.settings.myLocationButton = NO;
  self.mapView.shouldDisplaySpeedometer = NO;
  self.mapView.shouldDisplaySpeedLimit = NO;
  [self.mapController.view addSubview:self.mapView];
  [self applyCarStyle];
  [self tryAttach];

  self.attachTimer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                       target:self
                                                     selector:@selector(tryAttach)
                                                     userInfo:nil
                                                      repeats:YES];
  NSLog(@"CAMALERT_CARPLAY connected");
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
didDisconnectInterfaceController:(CPInterfaceController *)interfaceController
                      fromWindow:(CPWindow *)window
{
  // The phone keeps the same Google session and its progress.
  [self.attachTimer invalidate];
  self.attachTimer = nil;
  [self.attachedNavigator removeListener:self];
  self.attachedNavigator = nil;
  self.attachedSession = nil;
  self.navigationSession = nil;
  self.trip = nil;
  self.mapView = nil;
  self.mapTemplate = nil;
  self.carWindow = nil;
  self.interfaceController = nil;
  self.carConnected = NO;
  if (CamAlertActiveCarPlay == self) CamAlertActiveCarPlay = nil;
  NSLog(@"CAMALERT_CARPLAY disconnected");
}

- (NSArray<CPMapButton *> *)mapButtons
{
  __weak CarPlaySceneDelegate *weakSelf = self;
  CPMapButton *zoomIn = [[CPMapButton alloc] initWithHandler:^(CPMapButton *button) {
    [weakSelf changeZoom:1];
  }];
  zoomIn.image = [UIImage systemImageNamed:@"plus.magnifyingglass"];
  CPMapButton *zoomOut = [[CPMapButton alloc] initWithHandler:^(CPMapButton *button) {
    [weakSelf changeZoom:-1];
  }];
  zoomOut.image = [UIImage systemImageNamed:@"minus.magnifyingglass"];
  CPMapButton *pan = [[CPMapButton alloc] initWithHandler:^(CPMapButton *button) {
    [weakSelf.mapTemplate showPanningInterfaceAnimated:YES];
  }];
  pan.image = [UIImage systemImageNamed:@"arrow.up.and.down.and.arrow.left.and.right"];
  CPMapButton *recenter = [[CPMapButton alloc] initWithHandler:^(CPMapButton *button) {
    [weakSelf recenterOnCar];
  }];
  recenter.image = [UIImage systemImageNamed:@"location.fill"];
  return @[zoomIn, zoomOut, pan, recenter];
}

- (void)changeZoom:(float)delta
{
  if (self.mapView == nil) return;
  if (self.mapView.cameraMode == GMSNavigationCameraModeFollowing) {
    float current = self.mapView.followingZoomLevel;
    if (current == GMSNavigationNoFollowingZoomLevel || current < 8) current = 16;
    float next = MIN(20.0f, MAX(12.0f, current + delta));
    self.mapView.followingZoomLevel = next;
  } else {
    [self.mapView animateWithCameraUpdate:[GMSCameraUpdate zoomBy:delta]];
  }
}

- (void)recenterOnCar
{
  if (self.mapView == nil) return;
  self.mapView.cameraMode = GMSNavigationCameraModeFollowing;
  [self.mapTemplate dismissPanningInterfaceAnimated:YES];
}

- (void)applyCarStyle
{
  if (self.mapView == nil) return;
  UIUserInterfaceStyle style = self.carWindow.traitCollection.userInterfaceStyle;
  if (self.mapController.traitCollection.userInterfaceStyle == UIUserInterfaceStyleDark) {
    style = UIUserInterfaceStyleDark;
  }
  self.mapView.overrideUserInterfaceStyle = style;
  self.mapView.lightingMode = style == UIUserInterfaceStyleDark
    ? GMSNavigationLightingModeLowLight
    : GMSNavigationLightingModeNormal;
  NSLog(@"CAMALERT_CARPLAY style %ld", (long)style);
}

- (void)tryAttach
{
  if (!self.carConnected || self.mapView == nil) return;
  NavModule *nav = [NavModule sharedInstance];
  if (nav == nil || ![nav hasSession]) return;
  GMSNavigationSession *session = [nav getSession];
  GMSNavigator *navigator = session.navigator;
  if (session == nil || navigator == nil) return;

  if (self.attachedSession != session) {
    [self.attachedNavigator removeListener:self];
    self.attachedSession = session;
    self.attachedNavigator = navigator;
    [navigator addListener:self];
    BOOL enabled = [self.mapView enableNavigationWithSession:session];
    NSLog(@"CAMALERT_CARPLAY session attached %d guiding %d", enabled, navigator.guidanceActive);
  }
  if (navigator.guidanceActive) {
    [self ensureCarTripForNavigator:navigator];
  } else if (self.navigationSession != nil) {
    [self.navigationSession cancelTrip];
    self.navigationSession = nil;
    self.trip = nil;
    self.shownInstruction = nil;
    NSLog(@"CAMALERT_CARPLAY phone ended guidance");
  }
}

- (void)ensureCarTripForNavigator:(GMSNavigator *)navigator
{
  if (self.navigationSession != nil || self.mapTemplate == nil) return;
  GMSRouteLeg *leg = navigator.currentRouteLeg;
  if (leg == nil || !CLLocationCoordinate2DIsValid(leg.destinationCoordinate)) return;
  CLLocationCoordinate2D origin = self.mapView.myLocation.coordinate;
  if (!CLLocationCoordinate2DIsValid(origin) && leg.path.count > 0) {
    origin = [leg.path coordinateAtIndex:0];
  }
  if (!CLLocationCoordinate2DIsValid(origin)) return;

  NSString *title = leg.destinationWaypoint.title.length ? leg.destinationWaypoint.title : @"CamAlert";
  MKMapItem *originItem = [[MKMapItem alloc] initWithPlacemark:[[MKPlacemark alloc] initWithCoordinate:origin]];
  originItem.name = @"Start";
  MKMapItem *destinationItem = [[MKMapItem alloc] initWithPlacemark:[[MKPlacemark alloc] initWithCoordinate:leg.destinationCoordinate]];
  destinationItem.name = title;
  CPRouteChoice *choice = [[CPRouteChoice alloc] initWithSummaryVariants:@[title]
                                            additionalInformationVariants:@[]
                                                selectionSummaryVariants:@[title]];
  self.trip = [[CPTrip alloc] initWithOrigin:originItem destination:destinationItem routeChoices:@[choice]];
  self.navigationSession = [self.mapTemplate startNavigationSessionForTrip:self.trip];
  NSLog(@"CAMALERT_CARPLAY trip shown");
}

- (void)navigator:(GMSNavigator *)navigator didUpdateNavInfo:(GMSNavigationNavInfo *)navInfo
{
  if (!self.carConnected) return;
  if (navigator.guidanceActive) [self ensureCarTripForNavigator:navigator];
  if (self.navigationSession == nil || navInfo.navState != GMSNavigationNavStateEnroute) return;
  GMSNavigationStepInfo *step = navInfo.currentStep;
  if (step == nil) return;

  NSString *instruction = step.fullInstructionText.length ? step.fullInstructionText : step.fullRoadName;
  if (instruction.length == 0) return;
  if (![self.shownInstruction isEqualToString:instruction]) {
    self.shownInstruction = instruction;
    NSMutableArray<NSString *> *variants = [NSMutableArray arrayWithObject:instruction];
    if (step.simpleRoadName.length && ![variants containsObject:step.simpleRoadName]) {
      [variants addObject:step.simpleRoadName];
    }
    CPManeuver *maneuver = [[CPManeuver alloc] init];
    maneuver.instructionVariants = variants;
    UIImage *symbol = [step maneuverImageWithOptions:nil];
    if (symbol != nil) maneuver.symbolImage = symbol;
    if (@available(iOS 17.4, *)) {
      [self.navigationSession addManeuvers:@[maneuver]];
      if (step.fullRoadName.length) self.navigationSession.currentRoadNameVariants = @[step.fullRoadName];
    }
    self.navigationSession.upcomingManeuvers = @[maneuver];
    NSLog(@"CAMALERT_CARPLAY maneuver %@", instruction);
  }
  CPManeuver *current = self.navigationSession.upcomingManeuvers.firstObject;
  if (current == nil) return;
  NSMeasurement *stepDistance = [[NSMeasurement alloc] initWithDoubleValue:MAX(navInfo.distanceToCurrentStepMeters, 0)
                                                                        unit:NSUnitLength.meters];
  CPTravelEstimates *stepEstimates = [[CPTravelEstimates alloc] initWithDistanceRemaining:stepDistance
                                                                             timeRemaining:MAX(navInfo.timeToCurrentStepSeconds, 0)];
  [self.navigationSession updateTravelEstimates:stepEstimates forManeuver:current];
  if (self.trip != nil) {
    NSMeasurement *tripDistance = [[NSMeasurement alloc] initWithDoubleValue:MAX(navInfo.distanceToFinalDestinationMeters, 0)
                                                                          unit:NSUnitLength.meters];
    CPTravelEstimates *tripEstimates = [[CPTravelEstimates alloc] initWithDistanceRemaining:tripDistance
                                                                               timeRemaining:MAX(navInfo.timeToFinalDestinationSeconds, 0)];
    [self.mapTemplate updateTravelEstimates:tripEstimates forTrip:self.trip];
  }
}

- (void)navigator:(GMSNavigator *)navigator didArriveAtWaypoint:(GMSNavigationWaypoint *)waypoint
{
  if (self.navigationSession == nil) return;
  [self.navigationSession finishTrip];
  self.navigationSession = nil;
  self.trip = nil;
  self.shownInstruction = nil;
  NSLog(@"CAMALERT_CARPLAY arrived");
}

- (void)presentAlertTitle:(NSString *)title subtitle:(NSString *)subtitle
{
  if (self.mapTemplate == nil || title.length == 0) return;
  NSArray<NSString *> *subtitles = subtitle.length ? @[subtitle] : @[];
  CPAlertAction *dismiss = [[CPAlertAction alloc] initWithTitle:@"OK"
                                                           style:CPAlertActionStyleDefault
                                                         handler:^(CPAlertAction *action) {}];
  CPNavigationAlert *alert = [[CPNavigationAlert alloc] initWithTitleVariants:@[title]
                                                             subtitleVariants:subtitles
                                                                         image:nil
                                                                 primaryAction:dismiss
                                                               secondaryAction:nil
                                                                      duration:8];
  [self.mapTemplate presentNavigationAlert:alert animated:YES];
  NSLog(@"CAMALERT_CARPLAY alert %@", title);
}

- (void)mapTemplateDidBeginPanGesture:(CPMapTemplate *)mapTemplate
{
  [self.mapView didBeginPanGesture];
}

- (void)mapTemplate:(CPMapTemplate *)mapTemplate
didUpdatePanGestureWithTranslation:(CGPoint)translation
            velocity:(CGPoint)velocity
{
  [self.mapView didUpdatePanGestureWithTranslation:translation velocity:velocity];
}

- (void)mapTemplate:(CPMapTemplate *)mapTemplate didEndPanGestureWithVelocity:(CGPoint)velocity
{
  [self.mapView didEndPanGestureWithVelocity:velocity];
}

@end
