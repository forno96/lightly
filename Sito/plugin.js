function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';
  for (var i = 5; i > tmp; i--) {ret += '0';}
  return ret + value;
}
function getTime(){ return (new Date().toJSON());}

/*
INS, DEL
*/
class Mechanical {
  constructor(){
    this.editMech = 0;
    this.stackMech = [];
    this.revertedMech = [];
  }

  insItem(op, pos, content, by){
    this.stackMech.push({
      "id": "mech-" + sanitizeID(this.editMech),
      "op": op,
      "pos": pos,
      "content": content,
      "by": by,
      "timestamp": getTime(),
    });

    this.editMech++;
    return (this.editMech -1);
  }

  get stack() { return(this.stackMech); }
  get revertedstack() {return(this.revertedMech);}

  remItem(i) {
    var item = this.stackMech.splice(i,1)[0];
    this.revertedMech.push(item);
    return(item);
  }

  remRevert(i){ return(this.revertedMech.splice(i,1)[0]); }
  emptyRevertedMech() {this.revertedMech = [];}
}

/*
NOOP, WRAP/UNWRAP, JOIN/SPLIT, REPLACE, INSERT/DELETE,
PUNTUATION, WORDREPLACE, WORDCHANGE, TEXTREPLACE
*/
class Structular {
  constructor(){
    this.stackStruct = [];
    this.editStruct = 0;
  }

  insItem(op, by, mech, listMech, old, nw){
    var item = {
      "id": "struct-" + sanitizeID(this.editStruct),
      "op": op,
      "old": old,
      "new": nw,
      "by": by,
      "timestamp": getTime(),
      "items": []
    };

    listMech.forEach((i) => {
      item.items.push(mech.retItem(i));
    });

    this.stackStruct.push(item);

    this.editStruct++;
    return (this.editStruct -1);
  }

  get stack(){ return(this.stackStruct);}
  retItem(i) {return(this.stackStruct[i]);}
}

/*
MEANING, FIX, STYLE, EDITCHAIN, EDITWAR, EDITWAKE
*/
class Semantic {
  constructor(){
    this.stackSem = [];
    this.editSem = 0;
  }

  insItem(op, by, struct, listStruct, old, nw){

    var item = {
      "id": "sem-" + sanitizeID(this.editSem),
      "op": op,
      "old": old,
      "new": nw,
      "items": []
    };

    listStruct.forEach((i) => {
      item.items.push(struct.retItem(i));
    });

    this.stackSem.push(item);

    this.editSem++;
    return (this.editSem -1)
  }

  get stack(){ return(this.stackSem);}
}

/* ----- */
// INIT CLASS and VAR
oldState = undefined;
var by = "";
var mech = new Mechanical();
//var struct = new Structular();
//var sem = new Semantic();

const delay = ms => new Promise(res => setTimeout(res, ms));

var editor;

async function checkChange(){
  let loaded = false;
  while (loaded == false) {
    try {
      editor = tinyMCE.activeEditor.iframeElement.contentDocument.getElementsByTagName('body')[0];
      loaded = true;
    }
    catch(err) { await delay(200); } // Per dare il tempo a tinyMCE di caricarsi, err sta perchè è supportato solo da ES10
  }
  while (true) {
    catchChange();
    await delay(800); // Ogni quanto va rilanciata
  }
}

function catchState(){ return(editor.innerHTML); }

function loadState(state){ oldState = editor.innerHTML = state; }

function catchChange(){ // E' da far cercare il cambiamento solo all'interno di un range definito
  newState = catchState();

  if (oldState == undefined) {
    oldState = newState;
    console.log('State Loaded');
    return (false);
  }

  var start = 0;
  var newEnd = newState.length -1;
  var oldEnd = oldState.length -1;
  while ( start < newState.length && newState[start] == oldState[start] ) start ++;
  while ( newEnd >= start && oldEnd >= start && newState[newEnd] == oldState[oldEnd]) { // se c'è stato quache cambiamento allora è probabile che la lunghezza cambia
    newEnd --;
    oldEnd --;
  }

  if (start < newState.length) { // Se c'è stato un cambiamento
    // da inserire il le modifiche di tipo strutturale
    let del = oldState.slice(start,oldEnd+1);
    let add = newState.slice(start,newEnd+1);
    console.log(`State Changed    | "${del}" into "${add}"`);
    mech.insItem("DEL", start, del, by);
    mech.insItem("INS", start, add, by);
    mech.emptyRevertedMech();   // Se si fanno delle modifiche la coda con gli undo annulati va svuotata
  }
  else console.log('State Unchanged');

  oldState = newState;
}

function undoChange() {
  if (mech.stack.length == 0) { // Se la pila è vuota undoChange non deve fare nulla
    console.log("Undo stack is empty");
    return (false);
  }

  state = catchState();
  var add, rem;

  for (var i = 0; i < 2; i++) {
    item = mech.remItem(mech.stackMech.length-1);
    if (item.op == "INS") { // se op è INS toglie
      state = state.slice(0,item.pos) + state.slice(item.pos + item.content.length);
      rem = item.content;
    }
    else { // se op è DEL aggiunge
      state = state.slice(0,item.pos) + item.content + state.slice(item.pos);
      add = item.content;
    }
  }

  console.log(`Added "${add}" and Removed "${rem}"`);
  loadState(state);
  console.log("Undo Done");
}

function redoChange() {
  if (mech.revertedstack.length == 0) { // Se la pila è vuota redoChange non deve fare nulla
    console.log("Redo stack is empty");
    return (false);
  }

  state = catchState();
  var add, rem;

  for (var i = 0; i < 2; i++) {
    item = mech.remRevert(mech.revertedstack.length-1);
    if (item.op == "INS") { // se op è INS aggiunge
      state = state.slice(0,item.pos) + item.content + state.slice(item.pos);
      mech.insItem("INS", item.pos, item.content, item.by);
      add = item.content;
    }
    else { // se op è DEL toglie
      state = state.slice(0,item.pos) + state.slice(item.pos + item.content.length);
      mech.insItem("DEL", item.pos, item.content, item.by);
      rem = item.content;
    }
  }

  console.log(`Added "${add}" and Removed "${rem}"`);
  loadState(state);
  console.log("Redo Done");
}

tinymce.PluginManager.add('UndoStack', function(editor, url) {
  editor.on('BeforeAddUndo', function(e) {
    return false;
  });

  editor.ui.registry.addButton('Custom-Undo', {
    icon: 'undo',
    text: 'Undo',
    onAction: function () {
      undoChange();
    }
  });
  editor.shortcuts.add('ctrl+z', "Undo shortcut", function() { undoChange(); });


  editor.ui.registry.addButton('Custom-Redo', {
    icon: 'redo',
    text: 'Redo',
    onAction: function () {
      redoChange();
    }
  });
  editor.shortcuts.add('ctrl+shift+z', "Redo shortcut", function() { redoChange(); });


  return {
    getMetadata: function () {
      return  {
        name: "Undo stack plugin",
        url: "http://exampleplugindocsurl.com"
      };
    }
  };
});

checkChange();


function test(){
  var by = "Francesco";

  var mech = new Mechanical();
  var struct = new Structular();
  var sem = new Semantic();

  mech.insItem("DEL", 2343, "nuovo", by);
  mech.insItem("DEL", 446, "</p><p>", by);

  struct.insItem("NOOP", by, mech, [0,1]);

  sem.insItem("MEANING", by, struct, [0]);

  return sem.stack;
}
