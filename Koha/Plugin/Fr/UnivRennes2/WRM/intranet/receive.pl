#!/usr/bin/perl

use Modern::Perl;

use CGI qw ( -utf8 );
use C4::Auth qw( get_template_and_user get_session haspermission );
use C4::Circulation qw( barcodedecode GetBranchItemRule AddReturn updateWrongTransfer LostItem );
use C4::Output qw(output_html_with_http_headers);
use C4::Context;
use Cwd qw(abs_path);
use File::Basename qw( dirname fileparse );
use C4::Reserves qw(AddReserve CanItemBeReserved ModReserveAffect);
use DateTime::Duration;
use Koha::DateUtils qw(output_pref);
use Koha::Patrons;
#BEGIN {
#    use Cwd qw(abs_path);
#    use File::Basename qw( dirname fileparse );
#    unshift(@INC, dirname(abs_path($1)) . "/lib")#
#
#}
use lib qw(/var/lib/koha/form/plugins/Koha/Plugin/Fr/UnivRennes2/WRM/lib
           /var/lib/koha/prod/plugins/Koha/Plugin/Fr/UnivRennes2/WRM/lib
           /var/lib/koha/preprod/plugins/Koha/Plugin/Fr/UnivRennes2/WRM/lib
           /var/lib/koha/dev/plugins/Koha/Plugin/Fr/UnivRennes2/WRM/lib);
use Koha::WarehouseRequest;
use Koha::WarehouseRequests;
use Koha::WarehouseRequestStatus;

use Koha::Desks;

my $intranetpluginDir = dirname(abs_path($0));
my ($Dir, $pluginDir) = fileparse($intranetpluginDir);
my $template_name = $intranetpluginDir . '/receive.tt';

my $query = CGI->new;

#getting the template
my ( $template, $librarian, $cookie, $flags ) = get_template_and_user(
                                                                      {
                                                                       template_name   => $template_name,
                                                                       query           => $query,
                                                                       type            => "intranet",
                                                                       flagsrequired   => { circulate => "circulate_remaining_permissions" },
                                                                      }
                                                                     );

my $sessionID = $query->cookie("CGISESSID");
my $session = get_session($sessionID);
my $desk_id = C4::Context->userenv->{"desk_id"} // '';

print $query->redirect("/cgi-bin/koha/circ/set-library.pl?referer=/receive.pl")
  unless ($desk_id);

my $desk = Koha::Desks->find($desk_id);
my $error;
my $barcode = $query->param("barcode") // '';
$barcode =~ s/^\s*|\s*$//g;
$barcode = barcodedecode($barcode) if $barcode;

my $missing_barcode = $query->param("missing_barcode") // '';
$missing_barcode =~ s/^\s*|\s*$//g;
$missing_barcode = barcodedecode($missing_barcode) if $missing_barcode;

if ($missing_barcode ne '') {
    unless ($missing_barcode =~ /^[0-9]{10}$/ or $missing_barcode =~ /^[0-9]{14}$/) {
        $error = "$error, mauvais code barre : $missing_barcode";
        $missing_barcode = ""
    } elsif ($missing_barcode =~ /^574/) {
        $error = "$error, code barre de requête : $missing_barcode";
        $missing_barcode = ""
    }
}
my $wrid    = $query->param("wrid") // '';
my $op      = $query->param("op") // '';




my $barcode_type;
if ($barcode =~ /^574/) {
    $barcode_type = "stack_request" ;
} elsif ($barcode) {
    $barcode_type = "item" ;
}


if ($barcode_type eq "item" and $op eq "confirm") {
    local $@;
    eval {
        my $item = Koha::Items->find( { 'barcode' => $barcode } );
        my $wr   = Koha::WarehouseRequests->find({
                                                  'status' => 'PROCESSING',
                                                  'itemnumber' => $item->itemnumber,
                                                 });
        my $patron = Koha::Patrons->find($wr->borrowernumber);
        $template->param(
                         item   => $item,
                         patron => $patron,
                         wrid   => $wr->id,
                         desk   => $desk,
                         op     => "confirm",
                        );
    };
    if ($@) {
        $error = "$error, $@";
    }
} elsif ($barcode_type eq "stack_request" and $op eq "confirm") {
    $barcode =~ /^5740*([1-9][0-9]*)$/;
    my $wrid = $1;
    local $@;
    eval {
        my $wr   = Koha::WarehouseRequests->find($wrid);
        my $item = Koha::Items->find( $wr->itemnumber );
        my $patron = Koha::Patrons->find( $wr->borrowernumber );
        $template->param(
                         item   => $item,
                         patron => $patron,
                         wrid   => $wr->id,
                         desk   => $desk,
                         op     => "confirm",
                        );
    };
    if ($@) {
        $error = "$error, $@";
    }
} elsif (($barcode_type eq "item" or $missing_barcode) and ($op eq "confirmed" or $op eq "cancel") and $wrid >= 0) {
    my $wr   = Koha::WarehouseRequests->find($wrid);
    my $item = Koha::Items->find( $wr->itemnumber );
    my $patron = Koha::Patrons->find($wr->borrowernumber);
    $item->barcode($missing_barcode)->store()
      if ($missing_barcode and ! $item->barcode);
    $wr = $wr->complete();
    my $resid = AddReserve({
                            branchcode       => $wr->borrower->branchcode,
                            borrowernumber   => $wr->borrower->borrowernumber,
                            biblionumber     => $wr->item->biblionumber,
                            priority         => 0,
                            reservation_date => output_pref({ dt => DateTime->now, dateformat => 'iso' , dateonly => 1 }),
                            resevenotes      => 'FROM_STACKS',
                            itemnumber       => $wr->item->itemnumber(),
                            found            => 'W',
                            itemtype         => $wr->item->itype(),
                            desk_id          => $desk_id,
                           });
    #        ModReserveAffect( $wr->item->itemnumber, $wr->borrower->borrowernumber, '', $resid, $desk_id);
    my $res = Koha::Holds->find($resid);

    $template->param(
                     item    => $item,
                     reserve => $res,
                     op      => $op,
                     patron  => $patron,
                    )
} elsif ($op eq "cancel" and $wrid >= 0) {
    my $wr = Koha::WarehouseRequests->find( $wrid );
    my $item;
    $item = Koha::Items->find( $wr->itemnumber );
    my $patron = Koha::Patrons->find($wr->borrowernumber);
    $wr = $wr->complete();
    my $resid = AddReserve({
                            branchcode       => $wr->borrower->branchcode,
                            borrowernumber   => $wr->borrower->borrowernumber,
                            biblionumber     => $wr->item->biblionumber,
                            priority         => 0,
                            reservation_date => output_pref({ dt => DateTime->now, dateformat => 'iso' , dateonly => 1 }),
                            resevenotes      => 'FROM_STACKS',
                            itemnumber       => $wr->item->itemnumber(),
                            found            => 'W',
                            itemtype          => $wr->item->itype(),
                            desk_id             => $desk_id,
                           });
    #    ModReserveAffect( $wr->item->itemnumber, $wr->borrower->borrowernumber, '', $resid, $desk_id);
    my $res = Koha::Holds->find($resid);

    $template->param(
                     item    => $item,
                     barcode => $barcode,
                     reserve => $res,
                     op      => $op,
                     patron  => $patron,
                    )
}

$template->param(error => $error);


output_html_with_http_headers $query, $cookie, $template->output;
