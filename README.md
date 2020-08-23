### Titolo: Stack di Undo efficiente per [TinyMCE](https://www.tiny.cloud/),

### Obiettivi della tesi: Realizzare un metodo leggero salvataggio delle modifiche

### Stato della tesi: In Sviluppo

	7-23 Agosto: Ora si utilizza una mappa per salvare la posizione del cursore,
	sono stati miglirati i criteri per catturare il tipo di cambiamento e sono stati aggiunti INSERT e DELETE,
	è migliorato il log ed è nettamente più leggibile
	
	4-6 Agosto: Ho introdotto la classe di modifiche strutturali per catturare il wrap ed unwrap
	in modo che consuma meno memoria
	
	27-31 Luglio: C'è stata una pesante ricostruzione del codice per catturare la porzione da controllare,
	ora è molto più semplice, intuibile e da molti meno errori, come al solito KISS
	
	20-24 Luglio: Aggiunta di un range di ricerca sulla base della posizione del puntatore
	
	14 Luglio: Prove su ramo FLT e testing sulle performance dello stack re/un-do attuale
	
	13 Luglio: Riunione con Vitali e testing sulla fattibilità cambio di cattura della modifica 
	
	12 Luglio: Ulteriore testing su event listener
	
	11 Luglio: Il cursore viene spostato a destra della modifica dopo undo/redo
	
	10 Luglio: Disabilitato Undo di Tiny, messe icone e shortcut 
	
	9 Luglio: La cattura del cambiamento dava dei problemi, negli scorsi giorni
	ho provato a correggerlo con varie metodologie, ora prende le differenze in modo esatto,
	anche se forse l'utilizzo di tecniche più avanzate sarebbe più corretto.
	Proverò ad implementare una nuova soluzione.
	
	3 Luglio: Adesso il catch del cambiamento è molto più granulare, aggiunta del redo.
	
	1 Luglio: Aggiunta del revert.
	
	24 Giugno: Ottenimento dell'interno del documento in formato HTML.
	
	12 Giugno: Colloquio col professore per definire passi e sviluppi:
		È necessario avere uno spazio web dedicato dove mettere il test del sito
		Bisogna salvare le modifiche utilizzando minore memoria possibile le modifiche
		possono avvenire per via tastiera o per via bottoni
	
	Febbraio 2020: Inizio sviluppo della struttura a classi.
	
	Dicembre 2019: Presa in carico della tesi.


### Altri impegni che rallentano la tesi:Lavoro part time come sviluppatore

### [Link al progetto di tesi](http://site181980.tw.cs.unibo.it)
