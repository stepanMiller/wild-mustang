/** Short optional reactions. The runtime keeps all actor movement and quest state. */
const PRESENTATIONS = Object.freeze({
  'pet-hero': { duration:5.2, kind:'hero-pet' },
  'foal-freed': { duration:5.4, kind:'joy' },
  'meadow-rest': { duration:6.4, kind:'apple' },
  'ford-restored': { duration:3.6, kind:'thanks' },
  'ford-walk': { duration:4.2, kind:'walk' },
  'foal-crossed': { duration:4.2, kind:'walk' },
  'mountain-obstacle': { duration:4.4, kind:'joy' },
  'mountain-call': { duration:3.2, kind:'listen' },
  reunion: { duration:Infinity, kind:'reunion' }
});
const NO_GOALS = () => ({ active:false, effect:null, goals:{}, gestures:{}, formation:null });
const smooth = t => { t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
const distance = (actor,point) => Math.hypot(actor.position.x-point.x,actor.position.z-point.z);
const arrived = (actor,target) => Boolean(target)&&distance(actor,target)<=target.arrivalRadius+1e-4;

/**
 * trigger(effect, chapter) starts a disposable presentation, never a quest timer.
 * trigger('chapter', chapter) / reset(chapter) clears it on replay or Continue.
 * update returns optional goals, look-at headings and existing gesture strings.
 * Apply goals in the normal movement code; do not teleport actors to them.
 */
export function createCompanionScenes({ THREE, horse, foal, alex, herd, hAt, isSafeGoal }) {
  if(!THREE?.Vector3||!horse?.position||typeof hAt!=='function')throw new TypeError('Companion scenes need THREE, the hero and terrain.');
  let active=null, chapter=null;
  function familyMembers(){return Array.isArray(herd)?herd:herd?.children||[];}
  function parentActor(){const members=familyMembers();return members.find(actor=>actor.userData?.familyRole==='parent')||members[0]||null;}
  function visible(actor){
    if(!actor?.position)return false;
    for(let node=actor;node;node=node.parent)if(node.visible===false)return false;
    return true;
  }
  function reset(id=null){active=null;chapter=id==null?null:Number(id);}
  function trigger(effect,id=chapter||1){
    if(typeof effect==='number'){reset(effect);return true;}
    if(effect==='chapter'){reset(id);return true;}
    const presentation=PRESENTATIONS[effect];if(!presentation)return false;
    chapter=Number(id);active={effect,...presentation,chapter,elapsed:0,anchor:null};return true;
  }
  function point(x,z){const y=hAt(x,z);return Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(y)?{x,y,z}:null;}
  function goal(actor,x,z,{maxSpeed=3,lookAt=null,minimumHeight=1.4,referenceY=null}={}){
    if(!visible(actor))return null;
    const target=point(x,z);
    if(!target||target.y<minimumHeight||referenceY!=null&&Math.abs(target.y-referenceY)>2.2)return null;
    const radius=actor===alex ? .45 : actor===foal ? .65 : 1.15;
    const result={...target,maxSpeed,arrivalRadius:.5,radius};
    if(lookAt){result.lookAt={x:lookAt.x,z:lookAt.z};result.heading=Math.atan2(lookAt.x-x,lookAt.z-z);}
    if(isSafeGoal&&isSafeGoal(result,actor)===false)return null;
    return result;
  }
  function local(anchor,right,forward){
    const a=anchor.heading;
    return {x:anchor.x+Math.cos(a)*right+Math.sin(a)*forward,z:anchor.z-Math.sin(a)*right+Math.cos(a)*forward};
  }
  function reunionGoals(anchor={x:97,z:-94}){
    const center=point(Number(anchor.x),Number(anchor.z));if(!center)return null;
    const parent=parentActor(),members=familyMembers(),other=members.filter(actor=>actor!==parent);
    const parentPoint={x:center.x+4.6,z:center.z-1.2},foalPoint={x:center.x+5.4,z:center.z-3.2};
    const alexPoint={x:center.x-2.8,z:center.z+1.4};
    // The parent and child stand side by side facing home; their bodies do not
    // cross while the hero approaches. Alex has a place within the same frame.
    const faceHome={x:center.x-1,z:center.z-1.2};
    const parentGoal=goal(parent,parentPoint.x,parentPoint.z,{maxSpeed:4.0,lookAt:faceHome,referenceY:center.y});
    const foalGoal=goal(foal,foalPoint.x,foalPoint.z,{maxSpeed:4.8,lookAt:faceHome,referenceY:center.y});
    const alexGoal=goal(alex,alexPoint.x,alexPoint.z,{maxSpeed:4.2,lookAt:center,referenceY:center.y});
    const slots=[[-4.7,-2.1],[-1.5,-6.0],[3.0,-7.0],[7.0,2.6]];
    const herdGoals=[];
    if(parentGoal)herdGoals.push({actor:parent,...parentGoal});
    other.forEach((actor,index)=>{
      // Extra cast members remain spaced, even if a future chapter adds one.
      const slot=slots[index]||[Math.cos(index*2.4)*8.2,Math.sin(index*2.4)*8.2];
      const target=goal(actor,center.x+slot[0],center.z+slot[1],{maxSpeed:4.0,lookAt:center,referenceY:center.y});
      if(target)herdGoals.push({actor,...target});
    });
    return {hero:{...center},foal:foalGoal,alex:alexGoal,herd:herdGoals,parent};
  }
  function update(dt,state={}){
    const id=Number(state.chapter||chapter||1);
    if(chapter!=null&&chapter!==id){reset(id);return NO_GOALS();}
    if(!active)return NO_GOALS();
    if(active.chapter!==id){reset(id);return NO_GOALS();}
    const phase=state.phase;
    if(active.kind==='reunion'){
      if(id!==3||!['cine','epilogue','done'].includes(phase)){active=null;return NO_GOALS();}
      // Free exploration immediately resumes normal following. The final tableau
      // remains available separately via reunionGoals() for the cinematic only.
      if(phase==='epilogue'){active=null;return NO_GOALS();}
      if(state.paused)return NO_GOALS();
      const formation=reunionGoals(state.reunionAnchor);if(!formation)return NO_GOALS();
      const gestures={};
      if(arrived(foal,formation.foal))gestures.foal='sniff';
      if(arrived(alex,formation.alex))gestures.alex='wave';
      const parentGoal=formation.herd.find(target=>target.actor===formation.parent);
      if(arrived(formation.parent,parentGoal))gestures.parent='sniff';
      if(Math.abs(Number(state.player?.speed)||0)<.2)gestures.hero='sniff';
      return {active:true,effect:'reunion',goals:{foal:formation.foal,alex:formation.alex,herd:formation.herd},gestures,formation};
    }
    if(phase!=='quests'&&!(active.kind==='hero-pet'&&phase==='epilogue')){active=null;return NO_GOALS();}
    if(state.paused)return NO_GOALS();
    const player=state.player||{x:horse.position.x,z:horse.position.z,heading:horse.userData?.travelHeading??horse.rotation.y,speed:0};
    if(!Number.isFinite(player.x)||!Number.isFinite(player.z)){active=null;return NO_GOALS();}
    if(!active.anchor)active.anchor={x:player.x,z:player.z,heading:Number.isFinite(player.heading)?player.heading:0,y:hAt(player.x,player.z)};
    // A child can leave at any time. Galloping or moving away cancels the scene.
    if(Math.abs(Number(player.speed)||0)>3.8||Math.hypot(player.x-active.anchor.x,player.z-active.anchor.z)>5.2){active=null;return NO_GOALS();}
    active.elapsed+=Number.isFinite(dt)&&dt>0?Math.min(dt,.1):0;
    if(active.elapsed>=active.duration){active=null;return NO_GOALS();}
    const frame={active:true,effect:active.effect,goals:{},gestures:{},formation:null};
    const anchor=active.kind==='walk'?{...active.anchor,x:player.x,z:player.z,heading:player.heading??active.anchor.heading,y:hAt(player.x,player.z)}:active.anchor;
    const age=active.elapsed;
    if(active.kind==='hero-pet'){
      if(!visible(horse)||!visible(alex)||distance(horse,player)>1.2||distance(alex,horse.position)>6
        ||Math.abs(Number(player.speed)||0)>1.2||Math.hypot(player.x-anchor.x,player.z-anchor.z)>.8){active=null;return NO_GOALS();}
      const head=local(anchor,0,2.2),besideHead=local(anchor,1.15,1.8);
      const target=goal(alex,besideHead.x,besideHead.z,{maxSpeed:3.1,lookAt:head,referenceY:anchor.y});
      if(target)frame.goals.alex=target;
      if(Math.abs(Number(player.speed)||0)<.2){
        frame.gestures.hero='sniff';
        if(arrived(alex,target)&&distance(alex,horse.position)<3.4)frame.gestures.alex='pet';
      }
      return frame;
    }
    let foalPoint,alexPoint;
    if(active.kind==='joy'){
      const angle=-.7+smooth(age/2.4)*1.3;
      foalPoint=local(anchor,Math.cos(angle)*2.9,Math.sin(angle)*2.9);
      alexPoint=local(anchor,4.1,2.6);
    }else if(active.kind==='apple'){
      foalPoint=local(anchor,2.4,.9);alexPoint=local(anchor,4.0,1.7);
    }else if(active.kind==='walk'){
      foalPoint=local(anchor,1.7,-2.8);alexPoint=local(anchor,-1.6,-2.0);
    }else if(active.kind==='thanks'){
      foalPoint=local(anchor,1.8,-2.5);alexPoint=local(anchor,3.0,-1.1);
    }else{
      foalPoint=local(anchor,2.4,-1.5);alexPoint=local(anchor,3.5,.2);
    }
    const ford=active.kind==='walk'||active.kind==='thanks';
    const minimumHeight=ford?1.25:1.4;
    if(state.foalFreed){
      const target=goal(foal,foalPoint.x,foalPoint.z,{maxSpeed:active.kind==='joy'&&age<2.4?4.6:2.8,lookAt:alexPoint,minimumHeight,referenceY:anchor.y});
      if(target)frame.goals.foal=target;
    }
    const target=goal(alex,alexPoint.x,alexPoint.z,{maxSpeed:3.1,lookAt:foalPoint,minimumHeight,referenceY:anchor.y});
    if(target)frame.goals.alex=target;
    const foalArrived=arrived(foal,frame.goals.foal);
    const alexArrived=arrived(alex,frame.goals.alex);
    if(foalArrived&&active.kind!=='walk')frame.gestures.foal=active.kind==='apple'&&age>3.5?'graze':'sniff';
    // Offers/petting play only beside the foal, and waves after arrival, never
    // while Alex is running toward the child.
    if(alexArrived){
      if(active.kind==='apple'&&foalArrived)frame.gestures.alex=age<3.5?'offer':'pet';
      else if(active.kind==='listen'||active.kind==='walk')frame.gestures.alex='wave';
      else if(foalArrived)frame.gestures.alex='pet';
    }
    if(active.kind==='apple'&&Math.abs(Number(player.speed)||0)<.2)frame.gestures.hero='graze';
    return frame;
  }
  return {trigger,reset,update,reunionGoals,inspect:()=>active?{effect:active.effect,chapter:active.chapter,elapsed:active.elapsed,duration:active.duration}:null};
}
