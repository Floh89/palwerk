import { migrateState, STATE_SCHEMA_VERSION, validatePersonalState } from './state-schema.js';

const DB_NAME='palwerk';
const DB_VERSION=2;
const STATE_STORE='state';
const BACKUP_STORE='backups';
const META_STORE='meta';
const KEY='current';

function requestValue(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function transactionDone(transaction){return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB transaction aborted'));});}

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE);
      if(!db.objectStoreNames.contains(BACKUP_STORE))db.createObjectStore(BACKUP_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function readCurrent(db){return requestValue(db.transaction(STATE_STORE,'readonly').objectStore(STATE_STORE).get(KEY));}

async function writeBackup(db,state,reason='migration'){
  if(!state)return null;
  const id=`${new Date().toISOString()}-${reason}`;
  const transaction=db.transaction([BACKUP_STORE,META_STORE],'readwrite');
  transaction.objectStore(BACKUP_STORE).put({id,createdAt:new Date().toISOString(),reason,schemaVersion:Number(state.schemaVersion)||1,state:structuredClone(state)});
  transaction.objectStore(META_STORE).put(id,'latestBackupId');
  await transactionDone(transaction);
  return id;
}

async function writeCurrent(db,state){
  const transaction=db.transaction([STATE_STORE,META_STORE],'readwrite');
  transaction.objectStore(STATE_STORE).put(state,KEY);
  transaction.objectStore(META_STORE).put(STATE_SCHEMA_VERSION,'schemaVersion');
  await transactionDone(transaction);
}

export async function loadState(fallback={}){
  try{
    const db=await openDb();
    let value=await readCurrent(db);
    if(!value){
      const legacy=localStorage.getItem('palwerk-state-v1');
      if(legacy){
        value=JSON.parse(legacy);
        await writeBackup(db,value,'legacy-localstorage');
        const migrated=migrateState(value,fallback);
        await writeCurrent(db,migrated);
        localStorage.removeItem('palwerk-state-v1');
        db.close();
        return migrated;
      }
      const initial=migrateState(fallback,fallback);
      await writeCurrent(db,initial);
      db.close();
      return initial;
    }

    const requiresMigration=Number(value.schemaVersion)!==STATE_SCHEMA_VERSION||validatePersonalState(value).length>0;
    if(requiresMigration){
      await writeBackup(db,value,'schema-migration');
      value=migrateState(value,fallback);
      await writeCurrent(db,value);
    }
    db.close();
    return value;
  }catch(error){
    console.warn('IndexedDB unavailable, using migrated memory fallback.',error);
    return migrateState(fallback,fallback);
  }
}

export async function saveState(state){
  const normalized=migrateState(state,state);
  const errors=validatePersonalState(normalized);
  if(errors.length)throw new Error(`State validation failed: ${errors.join(', ')}`);
  const db=await openDb();
  await writeCurrent(db,normalized);
  db.close();
  return normalized;
}

export async function createBackup(reason='manual'){
  const db=await openDb();
  const current=await readCurrent(db);
  const id=await writeBackup(db,current,reason);
  db.close();
  return id;
}

export async function listBackups(){
  const db=await openDb();
  const rows=await requestValue(db.transaction(BACKUP_STORE,'readonly').objectStore(BACKUP_STORE).getAll());
  db.close();
  return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function restoreBackup(id){
  const db=await openDb();
  const backup=await requestValue(db.transaction(BACKUP_STORE,'readonly').objectStore(BACKUP_STORE).get(id));
  if(!backup){db.close();throw new Error('Backup not found');}
  const current=await readCurrent(db);
  await writeBackup(db,current,'before-restore');
  const restored=migrateState(backup.state,{});
  await writeCurrent(db,restored);
  db.close();
  return restored;
}
