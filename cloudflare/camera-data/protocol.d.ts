export interface PolicyInput {action:string; installation?:string; country?:string; jti?:string; exp?:number; generation?:string; status?:number; error?:string}
export interface PolicyResult {status:number; error?:string; retryAfter?:number; countries?:string[]; generation?:string}
export interface ManifestEntry {country_code:string; name_key:string; record_count:number; version:string; checksum:string; size_bytes:number; updated_at:string; geography_level?:string}
export interface DeliveryManifest {schema_version:2; generated_at:string; total_records:number; attribution?:string; license_url?:string; countries:ManifestEntry[]}
export interface TokenClaims {v:2; country:string; installation:string; version:string; iat:number; exp:number; jti:string; generation:string}
export interface PolicyState {requests?:number[]; failures?:number[]; newCountries?:{country:string; at:number}[]; active?:Record<string,{generation:string}>; tokens?:Record<string,{country:string; exp:number; uses:number; generation:string}>; installations?:{id:string;at:number}[]; blockedUntil?:number; lastSeen?:number}
export interface Coordinates {latitude:number;longitude:number}
export interface CameraPoint {id?:string|number; type?:string; camera_type?:string; latitude?:number; longitude?:number; speed_limit?:number; direction?:string|number; direction_code?:string|number; start?:Coordinates;end?:Coordinates; _example_only?:boolean; [key:string]:unknown}
export type Group = 'cameras'|'speed_cameras'|'red_light_cameras'|'checkpoints'|'average_speed_sections';
export type CameraFeed = Partial<Record<Group,CameraPoint[]>> & {red_light_sites?:CameraPoint[]};
export type MinimalFeed = CameraFeed & {schema_version:2;country:string;updated_at:string;record_count:number;counts:Record<string,number>};
