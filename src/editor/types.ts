export type MediaKind = 'video' | 'image' | 'audio'
export type Track = 'video' | 'audio'
export type MediaAsset = { id:string; name:string; kind:MediaKind; url:string; size:number; duration:number; sourcePath?:string }
export type Clip = { id:string; assetId:string; name:string; text?:string; textColor?:string; fontSize?:number; fontFamily?:string; fontWeight?:number; track:Track; trackIndex:number; start:number; duration:number; x:number; y:number; width:number; height:number; rotation:number; opacity:number; flipX:boolean; muted:boolean; volume:number }
export type Project = { id:string; name:string; createdAt:string; updatedAt:string; fps:number; resolution:{width:number;height:number}; playhead:number; isPlaying:boolean; media:MediaAsset[]; clips:Clip[] }
