class Mechanical {
  constructor(){ this.editMech = 0; }

  createItem(op, pos, content, by, newMap, oldMap){
    var item = {
      id: "mech-" + sanitizeID(this.editMech),
      op: op,
      pos: pos,
      content: content,
      by: by,
      timestamp: getTime(),
      newMap: newMap, // Serve per l'undo per mettere il cursore esattamente dove stava
      oldMap: oldMap  // Serve per l'undo per mettere il cursore esattamente dove stava
    };
    this.editMech++;

    return item;
  }
}
var mech = new Mechanical();

class Structural {
  constructor(){
    this.editStruct = 0;
    this.stackStruct = [];
    this.revertedStruct = [];
  }

  createItem(op, by, items){
    var item = {
      id: "structural-" + sanitizeID(this.editStruct),
      op: op,
      by: by,
      timestamp: getTime(),
      items: items
    };
    this.editStruct++;

    this.stackStruct.push(item);
    return item;
  }

  mv (from, to){
    var item = from.splice(from.length-1,1)[0];
    to[to.length] = item;
    return item;
  }
  remItem() { return this.mv(this.stackStruct, this.revertedStruct); }
  remRevert() { return this.mv(this.revertedStruct, this.stackStruct); }

  emptyRevertedStruct() { this.revertedStruct = []; }
}
var struct = new Structural();

// Dichiaro le variabili globali
var oldState, ed;
var by = "";

// Cerca il cambiamento nella stringa e lo salva
function catchChange(startNode, map){
  newState = catchState();
  if (oldState == undefined) oldState = newState;
  else if (oldState == newState) { console.log(""); console.log('State Unchanged'); }
  else {
    console.log("");
    var pos = getAbsPos(startNode);
    // Controllo da sinistra verso destra
    var start = sanitize(pos.start, Math.min(oldState.length, newState.length));
    while ( start < newState.length && start < oldState.length && newState[start] == oldState[start] ) { start ++; }

    // Controllo da destra verso sinistra
    var newEnd = newState.length -1 - pos.end; // Se c'è stato quache cambiamento allora è probabile che la lunghezza tra le 2 stringhe è cambiata
    var oldEnd = oldState.length -1 - pos.end; // Se c'è stato quache cambiamento allora è probabile che la lunghezza tra le 2 stringhe è cambiata
    while ( newEnd >= start && oldEnd >= start && newState[newEnd] == oldState[oldEnd]) { newEnd --; oldEnd --;}

    if (start < newState.length) { // Se c'è stato un cambiamento
      var del = oldState.slice(start,oldEnd+1);
      var add = newState.slice(start,newEnd+1);
      insItem(add, del, start, map);

      var range = 30;
      console.log(`State Changed "%c${cutString(del,range)}%c" into "%c${cutString(add,range)}%c" at pos %c${start}`,"color: red","","color: red","","font-weight: bold");
    }

    oldState = newState;
  }
}

// Capisce  il tipo di cambiamento e lo inserisce
function insItem(add, del, pos, oldMap){
  var items = [];

  var a = add.split(/(<[^<>]*>|[^<>]*>|<[^<>]*)/);
  var d = del.split(/(<[^<>]*>|[^<>]*>|<[^<>]*)/);

  var newMap = createMap();

  if (del != "" && add == "") {
    items[items.length] = mech.createItem("DEL", pos, del, by, newMap, oldMap);
    struct.createItem("DELETE", by, items);
  }
  else if (add != "" && del == "") {
    items[items.length] = mech.createItem("INS", pos, add, by, newMap, oldMap);
    struct.createItem("INSERT", by, items);
  }
  else if (a.slice(2,a.length-2).join("") == del) {
    items[items.length] = mech.createItem("INS", pos, a[1], by, newMap, oldMap);
    items[items.length] = mech.createItem("INS", pos+a.slice(0,a.length-2).join("").length, a[a.length-2], by, newMap, oldMap);
    struct.createItem("WRAP", by, items);
  }
  else if (a.slice(2,a.length-2).join("") == "<"+del+">") {
    items[items.length] = mech.createItem("INS", pos-1, "<"+a[1], by, newMap, oldMap);
    items[items.length] = mech.createItem("INS", pos+a.slice(0,a.length-2).join("").length, a[a.length-2]+">", by, newMap, oldMap);
    struct.createItem("WRAP", by, items);
  }
  else if (d.slice(2,d.length-2).join("") == add) {
    items[items.length] = mech.createItem("DEL", pos, d[1], by, newMap, oldMap);
    items[items.length] = mech.createItem("DEL", pos+d.slice(2,d.length-2).join("").length, d[d.length-2], by, newMap, oldMap);
    struct.createItem("UNWRAP", by, items);
  }
  else if (d.slice(2,d.length-2).join("") == "<"+add+">") { // Da finire
    items[items.length] = mech.createItem("DEL", pos-1, "<"+d[1], by, newMap, oldMap);
    items[items.length] = mech.createItem("DEL", pos+d.slice(2,d.length-2).join("").length-1, d[d.length-2]+">", by, newMap, oldMap);
    struct.createItem("UNWRAP", by, items);
  }
  else if (a.length>5 && d.length>5 &&  a.slice(2,a.length-2).join("") == d.slice(2,d.length-2).join("")) {
    items[items.length] = mech.createItem("DEL", pos, d[1], by, newMap, oldMap);
    items[items.length] = mech.createItem("DEL", pos+d.slice(2,d.length-2).join("").length, d[d.length-2], by, newMap, oldMap);
    items[items.length] = mech.createItem("INS", pos, a[1], by, newMap, oldMap);
    items[items.length] = mech.createItem("INS", pos+a.slice(0,a.length-2).join("").length, a[a.length-2], by, newMap, oldMap);
    struct.createItem("REPLACE", by, items);
  }
  else {
    items[items.length] = mech.createItem("DEL", pos, del, by, newMap, oldMap);
    items[items.length] = mech.createItem("INS", pos, add, by, newMap, oldMap);
    struct.createItem("CHANGE", by, items);
  }

  console.log("ADD:",a,"\nDEL:",d,`\nChange type: ${struct.stackStruct[struct.stackStruct.length-1].op}`);

  struct.emptyRevertedStruct(); // Se si fanno delle modifiche la coda con gli undo annulati va svuotata
}

// Se viende scatenato prende le ultime due modifiche scritte nella pila scelta in base al tipo (UNDO o REUNDO) e le applica
function revertChange(type) {
  // Se la pila è vuota undoChange non deve fare nulla
  console.log("");
  if (type == "UNDO" && struct.stackStruct.length == 0) console.log("Undo stack is empty");
  else if (type == "REDO" && struct.revertedStruct.length == 0) console.log("Redo stack is empty");
  else if (type == "REDO" || type == "UNDO"){
    var state = oldState;

    var range = 30; // Per il log

    var items;
    if (type == "UNDO") items = struct.remItem().items;
    else items = struct.remRevert().items;

    for (var i = 0; i < items.length; i++) {
      let index = type == "UNDO" ? items.length-1-i : i; // Il verso di lettura dipende se è un undo <- o un redo ->
      let item = items[index];
      if ((type == "UNDO" && item.op == "INS") || (type == "REDO" &&  item.op == "DEL")){
        // Caso di rimozione
        state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
        console.log(`Removed "%c${cutString(item.content,range)}%c" at pos %c${item.pos}`,"color: red","","font-weight: bold");
      }
      else {
        // Caso di aggiunta
        state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
        console.log(`Added "%c${cutString(item.content,range)}%c" at pos %c${item.pos}`,"color: red","","font-weight: bold");
      }
    }

    loadState(state);

    // Se è Undo il primo elemento letto è l'ultimo dell'array altrimenti è il primo
    var rightMap = type == "UNDO" ? items[items.length-1].oldMap : items[0].newMap;
    setCursorPos(rightMap);
  }
}

// Ottieni il blocco della stringa in base alla pos del puntatore
function getAbsPos(sc) {
  var r = range();

  var startContainer = sc;
  var endContainer = r.endContainer;

  // Calcolo start
  let start = 0;
  var walker = stepBackNode(goToMainNode(startContainer));
  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    if (walker.outerHTML != undefined) start += walker.outerHTML.length; // Se sono dentro un nodo che ne contiene altri, non ha senso che entro nei sottonodi, prendo la lunghezza totale
    else start += walker.nodeValue.length; // Altrimenti se sono dentro un nodo testo prendo la lungezza della stringa
    walker = stepBackNode(walker);
  }

  let end = 0;
  walker = stepNextNode(stepNextNode(goToMainNode(endContainer)));

  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    if (walker.outerHTML != undefined) end += walker.outerHTML.length;
    else end += walker.nodeValue.length;
    walker = stepNextNode(walker);
  }

  // Righe per fare un log carino
  var rng = 20;
  var state = catchState(), stateLen = state.length-1, endP =  stateLen - end + 1;
  console.log(`Range is from pos %c${start}%c to %c${endP}%c\n${state.slice(sanitize(start-rng, stateLen), start)}%c${state.slice(start, endP)}%c${state.slice(endP, sanitize(endP+rng,stateLen))}`,"font-weight: bold","","font-weight: bold","","color: red","");

  return ({ start: start, end: end });
}

// Mette il cursore sul dom
function setCursorPos(map){
  ed.focus();

  var start = navigateMap(map.start);
  var end = navigateMap(map.end);

  var sSize = start.node.innerText != null ? start.node.innerText.length : start.node.valueOf().length;
  var eSize = end.node.innerText != null ? end.node.innerText.length : end.node.valueOf().length;

  r = range();
  r.setStart(start.node, sanitize(start.offset, sSize));
  r.setEnd(end.node, sanitize(end.offset, eSize));
}

// Map serve per ottenere la posizione dei nodi
function createMap() {
  function genBracket(node, offset){
    var map = {child: null, offset: offset};
    if (node != ed) {
      do {
        let index = Array.from(node.parentNode.childNodes).findIndex((elem) => elem == node);
        map = {child: map, offset: index};
        node = node.parentNode;
      } while (node != ed);
    }
    else map = {child: map, offset: 0};

    return (map);
  }

  ed.normalize();
  var r = range();
  var bracket = genBracket(r.startContainer, r.startOffset);

  var ret = { start: bracket };
  ret.end = (r.startContainer==r.endContainer&&r.startOffset==r.endOffset) ? bracket : genBracket(r.endContainer, r.endOffset);

  return ret;
}
function navigateMap(map){
  var node = ed;
  var flag = true;
  while (map.child != null && flag){
    let offset = sanitize(map.offset, node.childNodes.length-1);
    if (node.childNodes[offset] == undefined) flag = false;
    else {
      node = node.childNodes[offset];
      map = map.child;
    }
  }
  return {node: node, offset: map.offset};
}

tinymce.PluginManager.add('UndoStack', function(editor, url) {
  // Disabilita l'undo built in
  editor.on('BeforeAddUndo', function(e) { return false; });

  editor.ui.registry.addButton('Custom-Undo', {
    text: 'Undo',
    icon: 'undo',
    tooltip: 'CTRL + Z',
    onAction: function () { revertChange("UNDO"); }
  });
  editor.shortcuts.add('ctrl+z', "Undo shortcut", function() { revertChange("UNDO"); });

  editor.ui.registry.addButton('Custom-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'CTRL + SHIFT + Z',
    onAction: function () { revertChange("REDO"); }
  });
  editor.shortcuts.add('ctrl+y', "Redo shortcut", function() { revertChange("REDO"); });

  editor.on('init', function() {
    ed = tinyMCE.activeEditor.dom.doc.body;
    catchChange();
    console.log("Undo Plugin Ready");
  });

  // Catturo la posizione del cursore prima dell modifica per controllare le modifiche da quel punto
  var saveMap = {used: true};
  function save(){
    if (saveMap.used == true) saveMap = {used: false, map: createMap()};
  }
  function lunchCatchChange(){
    // Passo il salvataggio della mappa a catchChange così si può posiszionare il cursore nella pos vecchia col revert
    catchChange(navigateMap(saveMap.map.start).node, saveMap.map);
    saveMap.used = true;
  }

  editor.on('BeforeExecCommand', function (){ save(); });
  editor.on('keydown', function(e) { save(); });

  // Dopo che è avvenuto il cambiamento mando la ricerca per catturarlo e salvarlo
  editor.on('ExecCommand', function(e) {
    //console.log("Event:", e);
    if (e.command == "Undo") revertChange("UNDO");
    else if (e.command == "Redo") revertChange("REDO");
    else lunchCatchChange();
  });
  editor.on('keyup', function(e) {
    //console.log("Event:", e);
    lunchCatchChange();
  });

  // Da eliminare più avanti
  // Funzione di download/upload per capire la dimensione di mech e dello stato
  editor.ui.registry.addButton('Download-State', {
    text: 'Download',
    icon: 'action-next',
    onAction: function () {download(editor);}
  });
  editor.ui.registry.addButton('Upload-State', {
    text: 'Upload',
    icon: 'action-prev',
    onAction: function () {upload(editor);}
  });

  return { getMetadata: function () { return  { name: "Undo stack plugin" }; }};
});

// Per organizzare mech
function sanitizeID(value){ return "0".repeat( sanitize(5-value.toString().length, 5) ) + value; }
function getTime(){ return (new Date().toJSON()); }

// Mette num tra 0 e max
function sanitize(num, max){ if(num<0){num = 0;} else if(num>max){num = max;} return num; }

// Ottieni i nodi principali
function isMainNode(node){ return(Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(node)); }
function goToMainNode(node){ while ( !isMainNode(node) ) { node = node.parentNode; } return node; }

// Si muovono sull'albero di body
function stepBackNode(node) {
  if (ed == node) return node;
  else if (node.previousSibling != undefined) node = node.previousSibling;
  else node = stepBackNode(node.parentNode);
  return node;
}
function stepNextNode(node) {
  if (ed == node) return node;
  else if (node.nextSibling != undefined) node = node.nextSibling;
  else node = stepNextNode(node.parentNode);
  return node;
}

// Funzioni su carico/scarico dello stato
function catchState() { return(ed.innerHTML); }
function loadState(state) { ed.innerHTML = state; oldState = state; }

// Ottieni il range dela selezione
// Rimossa l'opzione del clone
function range() { return tinyMCE.activeEditor.selection.getRng(); }

// Per il log
function cutString(str, size) { if (str.length > size + 3){str = str.slice(0,size/2) + "..." + str.slice(str.length-(size/2), str.length);} return str; }

// Da eliminare in deploy
function download(editor) {
  editor.windowManager.open({
    title: 'Download State',
    body: {
      type: 'panel',
      items: [{ type: 'input', name: 'title', label: 'Title'}]
    },
    buttons: [
      { type: 'cancel', text: 'Close' },
      { type: 'submit', text: 'Download', primary: true }
    ],
    onSubmit: function (api) {
      var data = api.getData();
      var title = data.title;
      function dw(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
      var state = catchState();
      dw(`UndoPlugin-${title}-state.txt`, state);
      dw(`UndoPlugin-${title}-mech.txt`, JSON.stringify(mech));
      dw(`UndoPlugin-${title}-all.txt`, JSON.stringify({state: state, struct: {edit: struct.editStruct, stack: struct.stackStruct, rev: struct.revertedStruct}}));
      console.log("File Downloaded");
      api.close();
    }
  });
}
function upload(editor) {
  var element = document.createElement('input');
  element.setAttribute('type', 'file');
  element.setAttribute('id', 'fileElem');
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  element.addEventListener("change", function () {
    var file = document.getElementById("fileElem").files;
    var fr = new FileReader();
    fr.onload = function(event) {
      var obj = JSON.parse(event.target.result);
      loadState(obj.state);
      struct.editStruct = obj.struct.edit;
      struct.stackStruct = obj.struct.stack;
      struct.revertedStruct = obj.struct.rev;
      console.log("File Uploaded");
      document.body.removeChild(element);
    };
    fr.readAsText(file[0]);
  }, false);
}
