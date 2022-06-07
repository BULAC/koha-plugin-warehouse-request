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
#BEGIN {
#    use Cwd qw(abs_path);
#    use File::Basename qw( dirname fileparse );
#    unshift(@INC, dirname(abs_path($1)) . "/lib")#
#
#}
use lib qw(/var/lib/koha/form/plugins/Koha/Plugin/Fr/UnivRennes2/WRM/lib);
use Koha::WarehouseRequest;
use Koha::WarehouseRequests;
use Koha::WarehouseRequestStatus;


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
my $desk_id = C4::Context->userenv->{"desk_id"} || '';

my $barcode = $query->param("barcode");

if ($barcode) {
    warn $barcode;
    $barcode =~ s/^\s*|\s*$//g;
    $barcode = barcodedecode($barcode) if $barcode;

    warn $barcode . " nettoyé";

    my $barcode_type;
    if ($barcode =~ /^574/) {
        $barcode_type = "stack_request" ;
    }
    elsif ($barcode) {
        $barcode_type = "item" ;
    }

    warn $barcode_type . " de type ";

    if ($barcode_type eq "stack_request") {

    }

    if ($barcode_type eq "item") {
        my $item = Koha::Items->find( { 'barcode' => $barcode } );
        warn 'itemnumber: ' . $item->itemnumber;
        my $wr   = Koha::WarehouseRequests->find(
            {
                'status' => 'PROCESSING',
                    'itemnumber' => $item->itemnumber,
            });
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
            itemtype          => $wr->item->itype()
                               });
        ModReserveAffect( $wr->item->itemnumber, $wr->borrower->borrowernumber, '', $resid, $desk_id);
        
    }
}

output_html_with_http_headers $query, $cookie, $template->output;
