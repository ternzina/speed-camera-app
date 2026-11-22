#import <React/RCTBridgeModule.h>
#import "CarPlaySceneDelegate.h"

@interface CamAlertCarPlayModule : NSObject <RCTBridgeModule>
@end

@implementation CamAlertCarPlayModule

RCT_EXPORT_MODULE(CamAlertCarPlay);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(showAlert:(NSString *)title subtitle:(NSString *)subtitle)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [CarPlaySceneDelegate presentAlertTitle:title subtitle:subtitle];
  });
}

@end
