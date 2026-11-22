#import <Foundation/Foundation.h>

// The CarPlay scene uses the Google session the phone already started.
// Connecting and disconnecting the car does not stop that session.
@interface CarPlaySceneDelegate : NSObject
+ (void)presentAlertTitle:(NSString *)title subtitle:(NSString *)subtitle;
@end
