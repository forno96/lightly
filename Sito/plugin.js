function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';

  for (var i = 5; i > tmp; i--) {ret += '0';}

  return ret + value;
}

function getTime(){ return (new Date().getTime());}

class Mechanical {
  constructor(){
    this.editMech = 0;
    this.stackMech = [];
  }

  insStack(op, pos, content, by){
    this.stackMech.unshift({
      "id": "mech-" + sanitizeID(this.editMech),
      "op": op,
      "pos": pos,
      "content": content,
      "by": by,
      "timestamp": getTime(),
    });

    this.editMech++;
  }

  get retStack(){ return(this.stackMech);}

  resetStack(){this.stackMech = [];}
}

var mech = new Mechanical();

/*
NOOP, WRAP/UNWRAP, JOIN/SPLIT, REPLACE, INSERT/DELETE,
PUNTUATION, WORDREPLACE, WORDCHANGE, TEXTREPLACE
*/
class Structular {
  constructor(){
    this.stackStruct = [];
    this.editStruct = 0;
  }

  insStack(op, by){
    /*mech.insStack("DEL",23,"ciao","Francesco");
    mech.insStack("DEL",23,"ciao","Francesco");*/

    var item = {
      "id": "struct-" + sanitizeID(this.editStruct),
      "op": op,
      "by": by,
      "timestamp": getTime(),
      "items": []
    }

    item.items = mech.retStack[0]

    this.stackStruct.unshift(item);

    this.editStruct++;
  }

  get retStack(){ return(this.stackStruct);}
}

var struct = new Structular();

tinymce.PluginManager.add('example', function(editor, url) {
  var openDialog = function () {
    return editor.windowManager.open({
      title: 'Example plugin',
      body: {
        type: 'panel',
        items: [
          {
            type: 'input',
            name: 'title',
            label: 'Title'
          }
        ]
      },
      buttons: [
        {
          type: 'cancel',
          text: 'Close'
        },
        {
          type: 'submit',
          text: 'Save',
          primary: true
        }
      ],
      onSubmit: function (api) {
        var data = api.getData();
        // Insert content when the window form is submitted
        editor.insertContent('Title: ' + data.title);
        api.close();
      }
    });
  };

  // Add a button that opens a window
  editor.ui.registry.addButton('example', {
    text: 'My bottone',
    onAction: function () {
      // Open window
      openDialog();
    }
  });

  // Adds a menu item, which can then be included in any menu via the menu/menubar configuration
  /*editor.ui.registry.addMenuItem('example', {
    text: 'Example plugin',
    onAction: function() {
      // Open window
      openDialog();
    }
  });*/

  return {
    getMetadata: function () {
      return  {
        name: "Undo stack plugin",
        url: "http://exampleplugindocsurl.com"
      };
    }
  };
});

tinymce.init({
  selector: 'textarea',
  plugins: 'example',
  toolbar: 'example a11ycheck addcomment showcomments casechange checklist code formatpainter insertfile pageembed permanentpen table',
  toolbar_drawer: 'floating',
  tinycomments_mode: 'embedded',
  tinycomments_author: 'Author name'
});
