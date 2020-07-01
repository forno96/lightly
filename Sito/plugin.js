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
  retItem(i)  { return(this.stackMech[i]); }

  remItem(i) { return(this.stackMech.splice(i,1)); }
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
var by = "Francesco";
var mech = new Mechanical();
//var struct = new Structular();
//var sem = new Semantic();

const delay = ms => new Promise(res => setTimeout(res, ms));

async function checkChange(){
  await delay(2000);
  while (true) {
    catchChange();
    await delay(2000);
  }
}

function createState(){
  state = tinyMCE.activeEditor.iframeElement.contentDocument.getElementsByTagName('body')[0].innerHTML.split("<");
  state.forEach((item, i) => {if (item != "") state[i] = "<" + item;});
  return(state)
}

function loadState(state){
  oldState = state;
  tinyMCE.activeEditor.iframeElement.contentDocument.getElementsByTagName('body')[0].innerHTML = oldState.join("")
}

function catchChange(){
  newState = createState();

  if (oldState == undefined) {
    oldState = newState;
    console.log(`State Loaded     |  ${oldState}`);
  }

  lenN = 0;
  lenO = 0;
  lenOfChange = 0;
  posOfChange = 0;

  newState.forEach((item, i) => {
    lenN += newState[i].length;
    if (oldState.length>i) lenO += oldState[i].length;
    if (newState[i] != oldState[i]){
      lenOfChange = lenN;
      posOfChange = i;
      //console.log(`${oldState[i]} CHANGED IN ${newState[i]}`);
    }
  });

  if (lenO != lenN) {
    console.log(`State Changed    |  ${newState}`);
    mech.insItem("DEL", lenOfChange, oldState[posOfChange], by);
    mech.insItem("INS", lenOfChange, newState[posOfChange], by);
  }
  else console.log(`State Unchanged  |  ${oldState}`);

  oldState = newState;
}

function revertChange(){
  if (mech.stack.length == 0) return(false);

  var i = mech.stack.length;
  do { i --;
  } while ((i>0) && !((mech.retItem(i).op == "INS") && (mech.retItem(i-1).op == "DEL")));

  if ((mech.retItem(i).op == "INS") && (mech.retItem(i-1).op == "DEL")) {
    removeIt = mech.remItem(i)[0];

    newState = createState();
    index = newState.findIndex((element) => {
      return(element == removeIt.content);
    });

    newState[index] = mech.remItem(i-1)[0].content;
    loadState(newState);
  }
}

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


tinymce.PluginManager.add('example', function(editor, url) {
  // Add a button that opens a window
  editor.ui.registry.addButton('example', {
    text: 'Revert',
    onAction: function () {
      revertChange();
    }
  });

  return {
    getMetadata: function () {
      return  {
        name: "Undo stack plugin",
        url: "http://exampleplugindocsurl.com"
      };
    }
  };
});
