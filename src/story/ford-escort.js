/** Actual shallow-ford escort, without timers, quest writes or actor mutation. */
export function fordEscort(player,{foal,alex}={},helpers={}) {
  const {questId,phase,chapter=2,riverX,riverWidth,hAt,waterY=1.15,isSafeGoal}=helpers;
  const empty={goals:{},ready:false};
  if(questId!=='willow-crossing'||phase!=='quests'||chapter!==2||!player
    ||!Number.isFinite(player.x)||!Number.isFinite(player.z)||Math.abs(player.z-60)>10
    ||typeof riverX!=='function'||typeof riverWidth!=='function'||typeof hAt!=='function')return empty;
  const bank=z=>riverX(z)+riverWidth(z);
  if(!Number.isFinite(bank(player.z))||player.x<bank(player.z)+.5)return empty;
  function visible(actor){
    if(!actor?.position)return false;
    for(let node=actor;node;node=node.parent)if(node.visible===false)return false;
    return true;
  }
  function crossed(actor){
    if(!visible(actor))return false;
    const {x,z}=actor.position,y=hAt(x,z),east=bank(z);
    return Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(y)&&Number.isFinite(east)
      &&x>=east+.6&&y>=waterY+.1;
  }
  function target(actor,behind,z,maxSpeed,radius){
    if(!visible(actor))return null;
    const maximumX=Math.min(player.x,105);
    // At the earliest zone entry x=10, the normal 5 m foal offset remains in
    // water. These targets let both friends reach dry bank while the child waits.
    const nominalX=Math.min(player.x-behind,maximumX);
    const offsets=[[0,0],[0,1.4],[0,-1.4],[.9,0],[-.9,0],[.9,1.4],[.9,-1.4],
      [1.8,1.4],[1.8,-1.4],[0,2.6],[0,-2.6],[-.9,2.6],[-.9,-2.6]];
    for(const [dx,dz] of offsets){
      const goalZ=z+dz,east=bank(goalZ);
      if(!Number.isFinite(east))continue;
      const minimumX=east+1;
      if(minimumX>maximumX)continue;
      const x=Math.max(minimumX,Math.min(nominalX+dx,maximumX)),y=hAt(x,goalZ);
      if(!Number.isFinite(y)||y<waterY+.1)continue;
      const result={x,y,z:goalZ,maxSpeed,arrivalRadius:.5,radius,
        lookAt:{x:player.x,z:player.z},heading:Math.atan2(player.x-x,player.z-goalZ)};
      if(!isSafeGoal||isSafeGoal(result,actor)!==false)return result;
    }
    return null;
  }
  const goals={},foalGoal=target(foal,2,58.6,3,.65),alexGoal=target(alex,2.5,61.4,3.5,.45);
  if(foalGoal)goals.foal=foalGoal;
  if(alexGoal)goals.alex=alexGoal;
  return {goals,ready:crossed(foal)&&crossed(alex)};
}
