function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';
  for (var i = 5; i > tmp; i--) {ret += '0';}
  return ret + value;
}

function getTime(){ return (new Date().toJSON());}

function sanitize (num, max){   // mette il num nel range tra 0 e max
  num = num < 0 ? 0 : num;  // per far stare il range dentro il contenuto
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
var editor;

async function checkChange(){
  let loaded = false;
  while (loaded == false) {
    try {
      editor = tinyMCE.activeEditor.iframeElement.contentDocument.body;
      loaded = true;
    }
    catch(err) { await delay(200); } // Per dare il tempo a tinyMCE di caricarsi, err sta perchè è supportato solo da ES10
  }

  catchChange(); // Per caricare lo stato
  ["keyup", "click", "onclick"].forEach((event, i) => {
    document.addEventListener(event, catchChange);
    editor.addEventListener  (event, catchChange);
  });
}

function catchState() { return(tinymce.activeEditor.getContent()) }

function loadState(state) {
  tinymce.activeEditor.setContent(state);
  oldState = state;
}

function catchChange(){ // E' da far cercare il cambiamento solo all'interno di un range definito
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

  oldState = newState;
}

function undoChange() {
  catchChange();

  if (mech.stack.length == 0) { // Se la pila è vuota undoChange non deve fare nulla
    console.log("Undo stack is empty");
    return;
  }

  state = catchState();
  var add, rem;
  var cursorPos = 0;

  for (var i = 0; i < 2; i++) {
    item = mech.remItem(mech.stackMech.length-1);
    if (item.op == "INS") { // se op è INS toglie
      state = state.slice(0,item.pos) + state.slice(item.pos + item.content.length);
      rem = item.content;
    }
    else { // se op è DEL aggiunge
      state = state.slice(0,item.pos) + item.content + state.slice(item.pos);
      add = item.content;

      cursorPos += item.pos;
      if ( item.content == "&nbsp;" ) cursorPos += 1;
      else cursorPos += item.content.length;
    }
  }

  console.log(`Added "${add}" and Removed "${rem}"`);
  loadState(state);

  setCursorPos(cursorPos);
}

function redoChange() {
  if (mech.revertedstack.length == 0) { // Se la pila è vuota redoChange non deve fare nulla
    console.log("Redo stack is empty");
    return (false);
  }

  state = catchState();
  var add, rem;
  var cursorPos = 0;

  for (var i = 0; i < 2; i++) {
    item = mech.remRevert(mech.revertedstack.length-1);
    if (item.op == "INS") { // se op è INS aggiunge
      state = state.slice(0,item.pos) + item.content + state.slice(item.pos);
      mech.insItem("INS", item.pos, item.content, item.by);
      add = item.content;

      cursorPos += item.pos
      if ( item.content == "&nbsp;" ) cursorPos += 1;
      else cursorPos += item.content.length;
    }
    else { // se op è DEL toglie
      state = state.slice(0,item.pos) + state.slice(item.pos + item.content.length);
      mech.insItem("DEL", item.pos, item.content, item.by);
      rem = item.content;
    }
  }

  console.log(`Added "${add}" and Removed "${rem}"`);
  loadState(state);

  setCursorPos(cursorPos);
}

function setCursorPos(cur){
  editor.focus();

  var range = tinyMCE.activeEditor.selection.getRng();
  var fullNode = editor.firstChild;
  var walker = new tinymce.dom.TreeWalker(fullNode);

  var hasCursor = false;
  var cursor = sanitize (cur - (fullNode.tagName.length + 2), fullNode.innerHTML.length);
  //var end   = sanitize (Math.max(st, en) - (fullNode.tagName.length + 2), fullNode.innerHTML.length);
  walker.next();

  while (walker.current() != undefined && (!hasCursor || !hasEnd)){
    if (walker.current().outerHTML == undefined){ //se sei in un nodo text
      nodeLen = walker.current().textContent.length;
      if (cursor <= nodeLen && !hasCursor) {
        range.setStart(walker.current(), cursor);
        range.setEnd  (walker.current(), cursor);
        hasCursor = true;
      }
      cursor -= nodeLen;
      walker.next();
    }
    else {
      nodeLen = walker.current().outerHTML.length;
      if (cursor < nodeLen) {
        cursor -= walker.current().tagName.length + 2;
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
      undoChange();
    }
  });
  editor.shortcuts.add('ctrl+z', "Undo shortcut", function() { undoChange(); });


  editor.ui.registry.addButton('Custom-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'CTRL + SHIFT + Z',
    onAction: function () {
      redoChange();
    }
  });
  editor.shortcuts.add('ctrl+shift+z', "Redo shortcut", function() { redoChange(); });

  editor.on('ExecCommand', function() { catchChange(); });

  return {
    getMetadata: function () {
      return  { name: "Undo stack plugin" };
    }
  };
});

checkChange();
