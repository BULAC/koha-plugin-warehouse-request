<script>
let wr_borrowernumber;

$(document).ready(function() {
    if ($('#opac-user').length > 0) {
        wr_borrowernumber = $(".loggedinusername").data('borrowernumber');

        // Ajout de l'onglet dans la nav Bootstrap
        $('ul.nav-tabs').append(
            '<li class="nav-item">' +
                '<a class="nav-link" id="wrm-tab" href="#warehouse-requests" data-bs-toggle="tab">' +
                    'Demandes de document (?)' +
                '</a>' +
            '</li>'
        );

        // Ajout du panneau de contenu
        $('.tab-content').append(
            '<div class="tab-pane fade" id="warehouse-requests">Chargement...</div>'
        );

        // Chargement au clic sur l'onglet
        $('#wrm-tab').on('shown.bs.tab', function() {
            refreshWarehouseRequests(wr_borrowernumber);
        });
    }
});

function refreshWarehouseRequests(borrowernumber) {
    if (!borrowernumber) {
        console.error('WRM : borrowernumber non défini');
        return;
    }

    $.get('/api/v1/contrib/wrm/patrons/' + borrowernumber + '/requests', function(data) {
        var cnt = 0;
        var container = $('#warehouse-requests').empty();

        if (data.length > 0) {
            var table = $(
                '<table class="table table-bordered table-striped">' +
                    '<thead>' +
                        '<tr>' +
                            '<th>Document</th>' +
                            '<th>Date de demande</th>' +
                            '<th>Date souhaitée</th>' +
                            '<th>Statut</th>' +
                            '<th>Bibliothèque</th>' +
                            '<th>Action</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody></tbody>' +
                '</table>'
            );

            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                var cd = new Date(item.creationdate);
                var rd = new Date(item.requesteddate);

                var infoBlock = item.title || '';
                var extInfoBlock = [];
                if (item.volume) extInfoBlock.push('<span class="label">Volume(s) : ' + item.volume + '</span>');
                if (item.issue)  extInfoBlock.push('<span class="label">Numéro(s) : ' + item.issue + '</span>');
                if (item.date)   extInfoBlock.push('<span class="label">Date : ' + item.date + '</span>');
                if (extInfoBlock.length > 0) infoBlock += '<br />' + extInfoBlock.join(' | ');

                var cancelBtn = '';
                if (['CANCELED', 'COMPLETED'].indexOf(item.status) < 0) {
                    cancelBtn = '<button class="btn btn-danger btn-sm cancel-wr" data-id="' + item.id + '">Annuler</button>';
                    cnt++;
                }

                table.find('tbody').append(
                    '<tr>' +
                        '<td>' + infoBlock + '</td>' +
                        '<td>' + cd.toLocaleDateString() + ' ' + cd.toLocaleTimeString() + '</td>' +
                        '<td>' + rd.toLocaleDateString() + '</td>' +
                        '<td>' + colorStatus(item.statusstr, item.status) + '</td>' +
                        '<td>' + item.branchname + '</td>' +
                        '<td>' + cancelBtn + '</td>' +
                    '</tr>'
                );
            }

            container.append(table);

            // Délégation d'événement pour les boutons d'annulation
            container.on('click', '.cancel-wr', function() {
                if (confirm('Êtes-vous sûr(e) de vouloir annuler votre demande ?')) {
                    var id = $(this).data('id');
                    $.post('/api/v1/contrib/wrm/cancel/' + id, function() {
                        alert('Votre demande a été annulée avec succès');
                        refreshWarehouseRequests(borrowernumber);
                    }).fail(function() {
                        alert('Erreur lors de l\'annulation. Veuillez réessayer.');
                    });
                }
            });

        } else {
            container.append('<p>Aucune demande en cours</p>');
        }

        // Mise à jour du compteur dans l'onglet
        $('#wrm-tab').text('Demandes de document (' + cnt + ')');

    }).fail(function(xhr) {
        console.error('WRM API error:', xhr.status, xhr.responseText);
        $('#warehouse-requests').html(
            '<p class="alert alert-danger">Erreur lors du chargement des demandes (HTTP ' + xhr.status + ').</p>'
        );
    });
}

function colorStatus(str, code) {
    var cls = "badge";
    switch (code) {
        case "PENDING":
        case "PROCESSING":
            cls += " bg-warning";
            break;
        case "WAITING":
            cls += " bg-success";
            break;
        case "COMPLETED":
            cls += " bg-secondary";
            break;
        case "CANCELED":
            cls += " bg-danger";
            break;
    }
    return '<span class="' + cls + '">' + str + '</span>';
}
</script>
