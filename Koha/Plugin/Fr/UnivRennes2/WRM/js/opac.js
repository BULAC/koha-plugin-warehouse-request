let wr_borrowernumber;

$(document).ready(function() {
    if ($('#opac-user').length > 0) {
        wr_borrowernumber = $(".loggedinusername").data('borrowernumber');
        var wrm_loaded = false;

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
            if (!wrm_loaded) {
            refreshWarehouseRequests(wr_borrowernumber);
        }
        wrm_loaded = false; 
    });

    refreshWarehouseRequests(wr_borrowernumber, function() {
        wrm_loaded = true;
    });

    }
});


function refreshWarehouseRequests(borrowernumber, callback) {
    if (!borrowernumber) {
        console.error('WRM : borrowernumber non défini');
        return;
    }

    // Récupération du CSRF token depuis le meta tag Koha
    var csrfToken = $('meta[name="csrf-token"]').attr('content') || '';

    $.ajax({
        url: '/api/v1/contrib/wrm/patrons/' + borrowernumber + '/requests',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'x-csrf-token': csrfToken
        },
        success: function(data) {
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
                                //'<th>Action</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody></tbody>' +
                    '</table>'
                );

                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var cd = new Date(item.created_on);
                    var rd = new Date(item.deadline);

                    var infoBlock = item.biblio ? (item.biblio.title || '') : '';
                    var extInfoBlock = [];
                    if (item.volume) extInfoBlock.push('<span class="badge bg-secondary">Volume(s) : ' + item.volume + '</span>');
                    if (item.issue)  extInfoBlock.push('<span class="badge bg-secondary">Numéro(s) : ' + item.issue + '</span>');
                    if (item.date)   extInfoBlock.push('<span class="badge bg-secondary">Date : ' + item.date + '</span>');
                    if (extInfoBlock.length > 0) infoBlock += '<br />' + extInfoBlock.join(' ');

                    var cancelBtn = '';
                    if (['CANCELED', 'COMPLETED'].indexOf(item.status) < 0) {
                        cancelBtn = '<button class="btn btn-danger btn-sm cancel-wr" data-id="' + item.id + '">Annuler</button>';
                        cnt++;
                    }

                    var deadlineStr = item.deadline ? rd.toLocaleDateString() : '-';

                    table.find('tbody').append(
                        '<tr>' +
                            '<td>' + infoBlock + '</td>' +
                            '<td>' + cd.toLocaleDateString() + ' ' + cd.toLocaleTimeString() + '</td>' +
                            '<td>' + deadlineStr + '</td>' +
                            '<td>' + colorStatus(item.statusstr, item.status) + '</td>' +
                            '<td>' + (item.branchname || '') + '</td>' +
                            //'<td>' + cancelBtn + '</td>' +
                        '</tr>'
                    );
                }

                container.append(table);

                // Délégation d'événement pour les boutons d'annulation
                container.off('click', '.cancel-wr').on('click', '.cancel-wr', function() {
                    if (confirm('Êtes-vous sûr(e) de vouloir annuler votre demande ?')) {
                        var id = $(this).data('id');

                        $.ajax({
                            url: '/api/v1/contrib/wrm/cancel/' + id,
                            method: 'POST',
                            headers: {
                                'x-csrf-token': csrfToken
                            },
                            success: function() {
                                alert('Votre demande a été annulée avec succès');
                                refreshWarehouseRequests(borrowernumber);
                            },
                            error: function(xhr) {
                                console.error('WRM cancel error:', xhr.status, xhr.responseText);
                                alert('Erreur lors de l\'annulation (HTTP ' + xhr.status + '). Veuillez réessayer.');
                            }
                        });
                    }
                });

            } else {
                container.append('<p>Aucune demande en cours</p>');
                $('#wrm-tab').text('Demandes de document (0)');
            }

            $('#wrm-tab').text('Demandes de document (' + cnt + ')');

            if (typeof callback === 'function') {
                callback();
            }
        },
        error: function(xhr) {
            console.error('WRM API error:', xhr.status, xhr.responseText);
            $('#warehouse-requests').html(
                '<p class="alert alert-danger">Erreur lors du chargement des demandes (HTTP ' + xhr.status + ').</p>'
            );
            if (typeof callback === 'function') {
                callback();
            }
        }
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