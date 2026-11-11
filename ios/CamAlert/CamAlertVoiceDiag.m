#import <React/RCTBridgeModule.h>
#import "CamAlert-Swift.h"

@interface CamAlertVoiceDiag : NSObject <RCTBridgeModule>
@end

@implementation CamAlertVoiceDiag

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(append:(NSString *)line)
{
  [CamAlertVoiceDiagLog append:line];
}

RCT_EXPORT_METHOD(snapshot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([CamAlertVoiceDiagLog snapshot]);
}

@end
