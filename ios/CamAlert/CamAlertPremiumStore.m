#import <React/RCTBridgeModule.h>
#import "CamAlert-Swift.h"

@interface CamAlertPremiumStore : NSObject <RCTBridgeModule>
@end

@implementation CamAlertPremiumStore

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(loadProducts:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [CamAlertPremiumStoreKit loadProducts:^(NSArray<NSDictionary *> *rows) {
    resolve(rows);
  }];
}

RCT_EXPORT_METHOD(purchase:(NSString *)productId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [CamAlertPremiumStoreKit purchase:productId done:^(NSDictionary *result) {
    resolve(result);
  }];
}

RCT_EXPORT_METHOD(restore:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [CamAlertPremiumStoreKit restore:^(NSArray<NSDictionary *> *rows) {
    resolve(rows);
  }];
}

@end
