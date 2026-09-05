#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Placeholder identifiers for future Network Extension integration:
// - Bundle ID: com.example.TrustTunnelRN.Extension
// - App Group: group.com.example.TrustTunnelRN

@interface NativeTrustTunnel : RCTEventEmitter <RCTBridgeModule>
@end

@implementation NativeTrustTunnel

RCT_EXPORT_MODULE(NativeTrustTunnel);

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"vpn_state", @"vpn_query_log", @"vpn_core_log" ];
}

RCT_REMAP_METHOD(start,
                 start:(NSString *)serverName
                 config:(NSString *)config
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(nil);
}

RCT_REMAP_METHOD(stop,
                 stopWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(nil);
}

RCT_REMAP_METHOD(updateConfiguration,
                 updateConfigurationWithServerName:(NSString * _Nullable)serverName
                 config:(NSString * _Nullable)config
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(nil);
}

// No bundled core on iOS: Core Logging is a no-op.
RCT_REMAP_METHOD(setCoreLogging,
                 setCoreLogging:(BOOL)enabled
                 level:(NSString *)level
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(nil);
}

RCT_REMAP_METHOD(getCurrentState,
                 getCurrentStateWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(@0);
}

@end
