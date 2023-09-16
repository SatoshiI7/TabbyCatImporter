let importDataModified;

//Convert the given data to a compact object
let dataFormat = ({
	name = "",
	email = "",
	institution = "",
	independent = "",
	adj_core = "",
}) => {
	let ret = {
		name,
		email,
		institution,
		independent: Boolean(independent),
		adj_core: Boolean(adj_core),
	};
	ret.appendRowTo = (includeIndependent, includeAdjCore, jQuery) => {
		var returnRow = $("<tr></tr>");
		returnRow
			.append(`<td>${ret.name}</td>`)
			.append(`<td>${ret.email}</td>`)
			.append(`<td>${ret.institution}</td>`);
		if (includeIndependent) {
			returnRow.append(`<td>${ret.independent ? "○" : ""}</td>`);
		}
		if (includeAdjCore) {
			returnRow.append(`<td>${ret.adj_core ? "○" : ""}</td>`);
		}
		returnRow.appendTo(jQuery);
	};
	return ret;
};

async function loadFile() {
	const files = $("#formFile").prop("files");
	const workbook = XLSX.read(await files[0].arrayBuffer());
	const importData = XLSX.utils.sheet_to_json(
		workbook.Sheets[workbook.SheetNames[0]],
		{}
	);
	importDataModified = importData.map((row) => dataFormat(row));
	//console.log(importDataModified);
	createSummaryTable(importDataModified);
}

function createSummaryTable(tableArray) {
	$("#worksheet-area").empty();
	let includeIndependent,
		includeAdjCore = false;
	let necessaryIndices = ["name", "email", "institution"];
	//Process importDataModified and find the indices to display
	//Possible existence: team_name, team_reference, team_emoji, institution, team_category, speakers[0, 1, 2]
	if (tableArray.some((e) => e.independent)) {
		//Independent
		necessaryIndices.push("independent");
		includeIndependent = true;
	}
	if (tableArray.some((e) => e.adj_core)) {
		//Adj Core
		necessaryIndices.push("adj_core");
		includeAdjCore = true;
	}

	//Create the table
	//Create index
	let tableHeadRow = $("<tr></tr>");
	necessaryIndices.forEach((i) => {
		tableHeadRow.append(`<td>${i}</td>`);
	});
	//Create each team
	let tableBody = $("<tbody></tbody>");
	tableArray.forEach((team) => {
		team.appendRowTo(includeIndependent, includeAdjCore, tableBody);
	});
	$(`<table class="table table-striped table-hover"></table>`)
		.append($("<thead></thead>").append(tableHeadRow))
		.append(tableBody)
		.appendTo("#worksheet-area");
}

function updateResults(data) {
	$("#previous-results").empty();
	if (data.length == 0) {
		$("#previous-results").addClass("d-none");
	} else {
		$("#previous-results").removeClass("d-none");
		data.forEach((elem) => {
			$(`<li>${elem}</li>`).appendTo("#previous-results");
		});
	}
}

$(() => {
	$("#formFile").on("change", async () => {
		await loadFile();
	});
	$("#submit").on("click", (event) => {
		$("#submit").prop("disabled", true);
		$("#submit").empty();
		$("#submit").html(
			`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span role="status">Loading...</span>`
		);
		event.preventDefault();
		$.ajax({
			url: "judges",
			type: "POST",
			data: JSON.stringify({
				teams: importDataModified,
			}),
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: (e) => {
				updateResults(e.responseJSON);
				$("#submit").prop("disabled", false);
				$("#submit").html(`Submit`);
				$("#worksheet-area").empty();
			},
		});
	});
});
