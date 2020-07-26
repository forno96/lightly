function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';
  for (var i = 5; i > tmp; i--) {ret += '0';}
  return ret + value;
}

function getTime(){ return (new Date().toJSON());}

function sanitize (num, max){   // mette il num nel range tra 0 e max
  num = num < 0 ? 0 : num;      // per far stare il range dentro il contenuto
  num = num > max ? max : num;
  return num;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

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

/* ----- */
// INIT CLASS and VAR
oldState = undefined;
var by = "";
var mech = new Mechanical();
var ed;

function catchState() { return(tinyMCE.activeEditor.dom.doc.body.innerHTML) }
function loadState(state) { tinymce.activeEditor.setContent(state); oldState = state; }

function getAbsPos() {
  // Detemina il nodo dove dovrebbe essere presente il cambiamento in base alla posizione del cursore
  var r = tinyMCE.activeEditor.selection.getRng().cloneRange();

  let start = r.startOffset;
  var walker = new tinymce.dom.TreeWalker(r.startContainer);
  walker.prev();
  while (walker.current() != undefined && walker.current().tagName != "HEAD"){
    if (walker.current().outerHTML != undefined) { start += walker.current().outerHTML.length; walker = new tinymce.dom.TreeWalker(walker.current().previousSibling); }
    else                                         { start += walker.current().nodeValue.length; walker.prev();                                                         }
  }

  let end = 0;
  // endContainer potrebbe essere tutto il nodo e quindi fa sbagliare il conto
  if (r.endContainer == tinyMCE.activeEditor.dom.doc.body.firstChild) { walker = new tinymce.dom.TreeWalker(r.endContainer.childNodes[r.endOffset]); }
  else                                                                { walker = new tinymce.dom.TreeWalker(r.endContainer); walker.next(); }

  while (walker.current() != undefined){
    if (walker.current().outerHTML != undefined) { end += walker.current().outerHTML.length; walker = new tinymce.dom.TreeWalker(walker.current().nextSibling); }
    else                                         { end += walker.current().nodeValue.length; walker.next();                                                     }
  }

  var state = catchState(), stateLen = state.length-1, endP =  stateLen - end;
  console.log(`Range is from pos ${start} "${state.slice(sanitize(start-3, stateLen), start) + "[" + state[start] + "]" + state.slice(sanitize(start+1, stateLen), sanitize(start+4,stateLen))}" to pos ${endP} "${state.slice(sanitize(endP-3, stateLen), endP) + "[" + state[endP] + "]" + state.slice(sanitize(endP+1, stateLen), sanitize(endP+4,stateLen))}"`)

  return ({ start: start, end: end });
}

function catchChange(withRange){
  // Cerca il cambiamento nel range dato
  newState = catchState();

  if (oldState == undefined) {
    oldState = newState;
    console.log('State Loaded');
    return;
  }

  if (oldState == newState) {
    console.log('State Unchanged');
    return;
  }

  var offsetToStart = 0, offsetToEnd = 0;
  if (withRange == true){ // se voglio cercare nel range ottengo il range da getAbsPos()
    var ret = getAbsPos();
    offsetToStart = ret.start;
    offsetToEnd = ret.end;
  }

  var start = sanitize(offsetToStart, Math.min(oldState.length, newState.length));
  var newEnd = newState.length -1 - offsetToEnd;
  var oldEnd = oldState.length -1 - offsetToEnd;
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

  oldState = newState;
}

function applyChange(type) {
  // Se la pila è vuota undoChange non deve fare nulla
  if (type == "UNDO" && mech.stack.length == 0) {
    console.log("Undo stack is empty"); return;
  }
  else if (type == "REDO" && mech.revertedstack.length == 0) {
    console.log("Redo stack is empty"); return;
  }

  state = catchState();
  var add, rem;

  for (var i = 0; i < 2; i++) {

    if (type == "UNDO"){
      item = mech.remItem(mech.stackMech.length - 1);
      if (item.op == "INS") {
        state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
        rem = item;
      }
      else if (item.op == "DEL") {
        state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
        add = item;
      }
    }
    else if (type == "REDO"){
      item = mech.remRevert(mech.revertedstack.length - 1);
      if (item.op == "INS") {
        state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
        mech.insItem("INS", item.pos, item.content, item.by);
        add = item;
      }
      else if (item.op == "DEL") {
        state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
        mech.insItem("DEL", item.pos, item.content, item.by);
        rem = item;
      }
    }
  }

  //state.replace("&nbsp;"," ")
  var cursorPos = add.pos + add.content.length;

  loadState(state);
  setCursorPos(cursorPos);

  console.log(`Added "${add.content}" and Removed "${rem.content}"`);
}

function setCursorPos(cur){
  ed.focus();

  var range = tinyMCE.activeEditor.selection.getRng();
  var fullNode = ed.firstChild;
  var walker = new tinymce.dom.TreeWalker(fullNode);

  var hasCursor = false;
  var cursor = sanitize (cur - (fullNode.tagName.length + 2), fullNode.innerHTML.length);

  walker.next();

  while (walker.current() != undefined && !hasCursor){
    if (walker.current().outerHTML == undefined){ //se sei in un nodo text
      let nodeLen = walker.current().valueOf().length;
      console.log(walker.current())
      if (cursor <= nodeLen && !hasCursor) {
        tinymce.activeEditor.selection.setCursorLocation(walker.current(), cursor)
        hasCursor = true;
      }
      cursor -= nodeLen;
      walker.next();
    }
    else {
      var nodeLen = walker.current().outerHTML.length;
      console.log(walker.current().outerHTML);
      if (cursor < nodeLen) {
        cursor -= nodeLen - `${walker.current().innerHTML}</${walker.current().tagName}>`.length;
        walker.next();
      }
      else {
        cursor -= nodeLen;
        walker = new tinymce.dom.TreeWalker(walker.current().nextSibling);
      }
    }
  }
  console.log(`Cursor set to pos ${cur}`);
}

tinymce.PluginManager.add('UndoStack', function(editor, url) {
  editor.on('BeforeAddUndo', function(e) {
    return false;
  });

  editor.ui.registry.addButton('Custom-Undo', {
    text: 'Undo',
    icon: 'undo',
    tooltip: 'CTRL + Z',
    onAction: function () {
      applyChange("UNDO");
    }
  });
  editor.shortcuts.add('ctrl+z', "Undo shortcut", function() { applyChange("UNDO"); });


  editor.ui.registry.addButton('Custom-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'CTRL + SHIFT + Z',
    onAction: function () {
      applyChange("REDO");
    }
  });
  editor.shortcuts.add('ctrl+shift+z', "Redo shortcut", function() { applyChange("REDO"); });

  editor.on('init', function() {
    ed = tinyMCE.activeEditor.iframeElement.contentDocument.body;
    catchChange(false);
  });

  editor.on('ExecCommand', function(e) {
    console.log("Event:", e);
    catchChange(true);
  });
  editor.on('keyup', function(e) {
    console.log("Event:", e);
    catchChange(true);
  });

  return {
    getMetadata: function () {
      return  { name: "Undo stack plugin" };
    }
  };
});
