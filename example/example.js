var currentlySelectedWells = {}

//adapted from here: https://stackoverflow.com/questions/2631001/javascript-test-for-existence-of-nested-object-key
function getContent(data,key){
    keys = key.split('.')
    var currentObject = data;
    while(currentObject && keys.length) currentObject = currentObject[keys.shift()];
    return currentObject;
}


function create_plate(plate_id,selection_domain) {
    var plate = new SBS.Plate("#"+plate_id, [], "96", {
        rowHeight: 30,
        defaultColumnWidth: 80,
        writeWellContent: function(self,well, content) {
            var label = getContent(content,"wellData.sample");
            var referredLabel = getContent(content,"wellData.referredWell.wellData.sample");
            if(content && label) {
                well.text("I");
                well.attr('title',label);
            } else if(content && referredLabel) {
                well.text("O");
                well.attr('title',referredLabel);
            } else {
                well.text('-');
            }
        }
    });

    plate.setSelectionModel(new SBS.WellSelectionModel());

    plate.onWellClick.subscribe(function (e, args) {
        console.log(plate_id + ' well click');
        console.log(args);
        var x = plate.wellHasThisData(args.well,"wellData.sample");
        console.log(x);
        //args.grid.get
    });

    var plate_wellselector = new SBS.WellRangeSelector();
    plate_wellselector.onWellRangeSelected.subscribe(function (e, args) {
        console.log(plate_id + '  range');
    });
    plate.registerPlugin(plate_wellselector);

    plate.onWellEnter.subscribe(function (e, args) {
        //console.log(plate_id + '  mouse enter');
        //console.log(args);
    });

    plate.onSelectedWellsChanged.subscribe(function (e, args) {
        console.log(plate_id + '  selected wells changed for domain ' + selection_domain);

        current_plate_selection = getContent(currentlySelectedWells,selection_domain + '.plate_id');


        if(typeof(current_plate_selection) !== 'undefined' && current_plate_selection !== plate_id) {
            var old_plate = $('#'+current_plate_selection);
            var old_sbs = old_plate.data('sbsplate');
            old_sbs.getSelectionModel().setSelectedRanges([]);
        }
        currentlySelectedWells[selection_domain] = {
            plate_id: plate_id,
            selection: args
        }
        console.log("new selection");
        console.log(currentlySelectedWells);
    });

    //only try to set the data if this is an existing library plate this is being loaded
    if(plate_id!=='new-plate') {
        set_plate_data(plate_id);
    }


}

set_plate_data = function(plate_id) {
    $.ajax({
        url: "data.json",
        type: 'GET',
        success: function(result) {
            var plate = $('#'+plate_id);
            var sbs = plate.data('sbsplate');
            var wellArray = $.map(result.derivative, function(value, index) {
                return [value];
            });
            sbs.setData(wellArray);
        },
        error: function(xhr,status,result) {
            alert(xhr.responseText);
        }
    });
}




$(document).ready(function () {
	create_plate('test-plate','output');
        $('#new-plate-button').on('click',function(){
            console.log('adding new empty plate');
        });
});
