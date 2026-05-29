$(document).ready(function() {
    // Home button injection
    if ($('#main_intranet-main').length > 0) {
        $.get({
            url: "/api/v1/contrib/wrm/count",
            cache: true,
            success: function (data) {
                if (data.count > 0) {
                    var wrlink = `<div class="pending-info" id="warehouse_requests_pending">
                                    <a href="/cgi-bin/koha/plugins/run.pl?class=Koha%3A%3APlugin%3A%3AFr%3A%3AUnivRennes2%3A%3AWRM&method=tool#warehouse-requests-processing">Demandes magasin en attente </a>:
                                    <span class="pending-number-link">`+ data.count + `</span>
                                </div>`;
                    if ($('#area-pending').length > 0) {
                        $('#area-pending').prepend(wrlink);
                    } else {
                        $('#container-main > div.row > div.col-sm-9 > div.row:last-child div.col-sm-12').append('<div id="area-pending">' + wrlink + '</div>');
                    }
                }
            }
        });
    }
    // Circ homepage button injection
    if ($('#circ_circulation-home').length > 0) {
        var wrbutton = '<li><a class="circ-button" href="/cgi-bin/koha/plugins/run.pl?class=Koha%3A%3APlugin%3A%3AFr%3A%3AUnivRennes2%3A%3AWRM&method=tool#warehouse-requests-processing" title="Demandes magasins"><i class="fa fa-file-text"></i> Demandes magasins</a></li><li><a class="circ-button" href="/receive.pl" title="Réception"><i class="fa fa-rocket"></i> Réception</a></li>';
        var requestsMenu = $('i.fa-newspaper-o').parents('ul.buttons-list');
        if (requestsMenu.length > 0) {
            requestsMenu.prepend(wrbutton);
        } else {
            var delayedColumn = $('h3:contains("Retards")').parent();
            if (delayedColumn.length > 0) {
                delayedColumn.prepend('<h3>Demandes des adhérents</h3><ul class="buttons-list">' + wrbutton + '</ul>');
            } else {
                $('#circ_circulation-home div.main > div.row:first-child > div:last-child').prepend('<h3>Demandes des adhérents</h3><ul class="buttons-list">' + wrbutton + '</ul>');
            }
        }
    }

    // Nav menu injection (circ)
    if ($('#navmenulist').length > 0) {
        var $wrmSection = $(`
            <h5>Demandes des adhérents</h5>
            <ul>
                <li>
                    <a href="/cgi-bin/koha/plugins/run.pl?class=Koha%3A%3APlugin%3A%3AFr%3A%3AUnivRennes2%3A%3AWRM&method=tool#warehouse-requests-processing">
                        Demandes magasin
                    </a>
                </li>
                <li>
                    <a href="/receive.pl">
                        Réception
                    </a>
                </li>
            </ul>
        `);

        // On injecte après la section "Réservations" si elle existe,
        // sinon on ajoute à la fin du premier col-md-12
        var $reservationsHeader = $('#navmenulist h5').filter(function() {
            return $(this).text().trim() === 'Circulation';
        });

        if ($reservationsHeader.length > 0) {
            $reservationsHeader.next('ul').after($wrmSection);
        } else {
            $('#navmenulist .col-md-12').first().append($wrmSection);
        }
    }


    // Member tabs table injection
    if ($('#circ_circulation, #pat_moremember').length > 0) {

        var $tabContainer = $('#finesholdsissues');
        if ($tabContainer.length === 0) {
            $tabContainer = $('#patronlists');
        }

        var $tabNav     = $tabContainer.find('ul.nav-tabs').first();
        var $tabContent = $tabContainer.find('.tab-content').first();

        if ($tabNav.length === 0) {
            $tabNav     = $('ul.nav-tabs').first();
            $tabContent = $('.tab-content').first();
        }

        var borrowernumber = $('input[name="borrowernumber"]').val()
            || $('input#borrowernumber').val()
            || (window.location.search.match(/borrowernumber=(\d+)/) || [])[1]
            || $('.patroninfo ul li.patronborrowernumber').text().replace(/\D/g, '');

        if (!borrowernumber) {
            console.warn('WRM : borrowernumber introuvable, onglet non injecté');
        } else {

            var $newTab = $(
                '<li class="nav-item">' +
                    '<a class="nav-link" id="wrm-tab" data-bs-toggle="tab" ' +
                        'href="#warehouse-requests" role="tab">' +
                        'Demandes magasin (?)' +
                    '</a>' +
                '</li>'
            );

            var $newPane = $(
                '<div class="tab-pane" id="warehouse-requests" role="tabpanel">' +
                    '<p>Chargement...</p>' +
                '</div>'
            );

            $tabNav.append($newTab);
            $tabContent.append($newPane);

            $(document).on('shown.bs.tab', '#wrm-tab', function() {
                refreshWarehouseRequests(borrowernumber);
            });
            // Compatibilité Bootstrap 4
            $newTab.find('a').on('shown.bs.tab', function() {
                refreshWarehouseRequests(borrowernumber);
            });

            // Chargement immédiat (pour afficher le compteur même si l'onglet n'est pas actif)
            refreshWarehouseRequests(borrowernumber);
        }
    }

    // Catalog detail link
    let searchParams = new URLSearchParams(window.location.search);
    $('#catalog_detail #toolbar, #catalog_moredetail #toolbar').append('<div class="btn-group"><a id="placehold" class="btn btn-default " href="/cgi-bin/koha/plugins/run.pl?class=Koha%3A%3APlugin%3A%3AFr%3A%3AUnivRennes2%3A%3AWRM&method=tool&op=creation&biblionumber=' + searchParams.get('biblionumber') + '"><i class="fa fa-file-text-o"></i> Demande magasin</a></div>');
    if ($('body.circ div#menu, body.catalog div#menu').length > 0 && searchParams.get('biblionumber') != undefined) {
        $('body.circ div#menu ul:first-child, body.catalog div#menu ul:first-child').append('<li><a id="wr-menu-link" href="/cgi-bin/koha/plugins/run.pl?class=Koha%3A%3APlugin%3A%3AFr%3A%3AUnivRennes2%3A%3AWRM&method=tool&op=creation&biblionumber=' + searchParams.get('biblionumber') + '">Demandes magasin (?)</a></li>');
        $.get({
            url: "/api/v1/contrib/wrm/count?biblionumber=" + searchParams.get('biblionumber'),
            cache: true,
            success: function (data) {
                $('#wr-menu-link').text('Demandes magasin (' + data.count + ')');
            }
        });
        if ($('#circ_request-warehouse').length > 0) {
            $('#wr-menu-link').parent().addClass('active');
        }
    }
});

function refreshWarehouseRequests(borrowernumber) {

    if (!borrowernumber) {
        borrowernumber = $('input[name="borrowernumber"]').val()
            || $('input#borrowernumber').val()
            || (window.location.search.match(/borrowernumber=(\d+)/) || [])[1]
            || $('.patroninfo ul li.patronborrowernumber').text().replace(/\D/g, '');
    }

    if (!borrowernumber) {
        console.error('WRM refreshWarehouseRequests : borrowernumber indéfini');
        return;
    }

    $.get({
        url: "/api/v1/contrib/wrm/patrons/" + borrowernumber + '/requests',
        cache: true,
        success: function(data) {
            var cnt = 0;
            var result = $('#warehouse-requests').empty();

            result.append(
                '<table role="grid">' +
                    '<tbody></tbody>' +
                '</table>'
            );

            if (data.length > 0) {
                result.find('table').prepend(
                    '<thead>' +
                        '<tr>' +
                            '<th>N°</th>' +
                            '<th>Informations</th>' +
                            '<th>Demandé le</th>' +
                            '<th>À chercher avant le</th>' +
                            '<th>Statut</th>' +
                            '<th>Site de retrait</th>' +
                            '<th></th>' +
                        '</tr>' +
                    '</thead>'
                );

                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var cd = new Date(item.created_on);
                    var rd = item.deadline ? new Date(item.deadline) : null;

                    // Bloc infos document
                    var infoBlock = '<div><a class="strong" href="/cgi-bin/koha/catalogue/detail.pl?biblionumber='
                        + item.biblionumber + '" title="' + (item.biblio.title || '') + '">'
                        + (item.biblio.title || '') + '</a></div>';

                    if (item.biblio.author) {
                        infoBlock += '<div>' + item.biblio.author + '</div>';
                    }
                    if (item.item && item.item.itemcallnumber) {
                        infoBlock += '<div>Cote : ' + item.item.itemcallnumber
                            + '</div><div>Code-barres : ' + (item.item.barcode || '') + '</div>';
                    }

                    var extInfoBlock = [];
                    if (item.volume) extInfoBlock.push('<span class="label">Volume(s) : ' + item.volume + '</span>');
                    if (item.issue)  extInfoBlock.push('<span class="label">Numéro(s) : ' + item.issue + '</span>');
                    if (item.date)   extInfoBlock.push('<span class="label">Date : ' + item.date + '</span>');
                    if (extInfoBlock.length > 0) infoBlock += '<br />' + extInfoBlock.join(' | ');

                    // Boutons action
                    var actionBlock = '';
                    if (['CANCELED', 'COMPLETED'].indexOf(item.status) < 0) {
                        actionBlock = '<div class="btn-group">';
                        if (item.status === 'WAITING') {
                            actionBlock += '<a data-id="' + item.id
                                + '" title="Terminer la demande" class="complete-wr btn-xs btn btn-success">'
                                + '<i class="fa fa-fw fa-check"></i> Terminer</a>';
                        }
                        actionBlock += '<a data-id="' + item.id
                            + '" title="Annuler la demande" class="cancel-wr btn-xs btn btn-danger">'
                            + '<i class="fa fa-fw fa-close"></i> Annuler</a>'
                            + '</div>';
                        cnt++;
                    }
                    if (item.status === 'CANCELED') {
                        actionBlock += '<div class="reason">' + (item.notes || '') + '</div>';
                    }

                    var deadlineStr = rd ? rd.toLocaleDateString() : '-';

                    result.find('tbody').append(
                        '<tr>' +
                            '<td>' + item.id + '</td>' +
                            '<td>' + infoBlock + '</td>' +
                            '<td>' + cd.toLocaleDateString() + ' ' + cd.toLocaleTimeString() + '</td>' +
                            '<td>' + deadlineStr + '</td>' +
                            '<td class="nowrap">' + decodeURIComponent(item.statusstr) + '</td>' +
                            '<td>' + (item.branchname || '') + '</td>' +
                            '<td class="text-center">' + actionBlock + '</td>' +
                        '</tr>'
                    );
                }

                $('#wrm-tab').text('Demandes magasin (' + cnt + ')');

                result.find('table').dataTable($.extend(true, {}, dataTablesDefaults, {
                    "sDom": 't',
                    "aaSorting": [[0, "desc"]],
                    "aoColumnDefs": [
                        { "aTargets": [-1], "bSortable": false, "bSearchable": false }
                    ],
                    "bPaginate": false
                }));

                result.off('click', '.complete-wr').on('click', '.complete-wr', function() {
                    var id = $(this).data('id');
                    $.ajax({
                        type: "POST",
                        url: "/api/v1/contrib/wrm/update_status",
                        data: { id: id, action: 'complete' },
                        success: function() {
                            alert('La demande a été terminée avec succès');
                            refreshWarehouseRequests(borrowernumber);
                        },
                        error: function(xhr) {
                            alert('Erreur : ' + (xhr.responseJSON ? xhr.responseJSON.error : xhr.responseText));
                        }
                    });
                });

                result.off('click', '.cancel-wr').on('click', '.cancel-wr', function() {
                    var notes = prompt('Raison de l\'annulation :');
                    if (notes !== null) {
                        var id = $(this).data('id');
                        $.ajax({
                            type: "POST",
                            url: "/api/v1/contrib/wrm/update_status",
                            data: { id: id, action: 'cancel', notes: notes },
                            success: function() {
                                alert('La demande a été annulée avec succès');
                                refreshWarehouseRequests(borrowernumber);
                            },
                            error: function(xhr) {
                                alert('Erreur : ' + (xhr.responseJSON ? xhr.responseJSON.error : xhr.responseText));
                            }
                        });
                    }
                });

            } else {
                result.find('tbody').append(
                    '<tr><td colspan="7">L\'adhérent n\'a pas de demandes magasin en cours.</td></tr>'
                );
                $('#wrm-tab').text('Demandes magasin (0)');
            }
        },
        error: function(xhr) {
            console.error('WRM API error:', xhr.status, xhr.responseText);
            $('#warehouse-requests').html(
                '<p class="alert alert-danger">Erreur lors du chargement des demandes (HTTP '
                + xhr.status + ').</p>'
            );
        }
    });
}
