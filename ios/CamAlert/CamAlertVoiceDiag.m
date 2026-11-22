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

RCT_EXPORT_METHOD(takeAudioDisruption:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve(@([CamAlertVoiceDiagLog takeAudioDisruption]));
}

RCT_EXPORT_METHOD(snapshot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([CamAlertVoiceDiagLog snapshot]);
}

RCT_EXPORT_METHOD(audioProbe:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([CamAlertVoiceDiagLog audioProbe]);
}

RCT_EXPORT_METHOD(readiness:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([CamAlertVoiceDiagLog readiness]);
}

RCT_EXPORT_METHOD(tripArmed:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve(@([CamAlertVoiceDiagLog tripArmed]));
}

RCT_EXPORT_METHOD(noteDiagnosticStartGuidance:(NSInteger)trip)
{
  [CamAlertVoiceDiagLog noteDiagnosticStartGuidance:trip];
}

RCT_EXPORT_METHOD(cancelDiagnosticActivation:(NSInteger)trip reason:(NSString *)reason)
{
  [CamAlertVoiceDiagLog cancelDiagnosticActivation:trip reason:reason ?: @""];
}

RCT_EXPORT_METHOD(activateDiagnosticSession:(NSInteger)trip
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  resolve([CamAlertVoiceDiagLog activateDiagnosticSession:trip]);
}

@end
