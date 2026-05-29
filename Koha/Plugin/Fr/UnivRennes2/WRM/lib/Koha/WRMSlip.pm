package Koha::WRMSlip;

use Modern::Perl;
use MIME::Base64 qw(encode_base64);

use C4::Context;
use Koha::Patrons;
use Koha::Desk;
use Koha::Biblios;
use Koha::Items;
use Koha::Biblioitems;
use Template;
use IPC::System::Simple qw(system);
use File::Temp qw(tempfile);
use File::Basename;
use File::Slurp qw(read_file write_file);
use Barcode::Code128;
use Encode qw(decode encode is_utf8);

use Koha::Plugin::Fr::UnivRennes2::WRM::Object::WarehouseRequests;
   
sub generateSlip {
    my ($plugin, $id) = @_;

    my $wr = Koha::Plugin::Fr::UnivRennes2::WRM::Object::WarehouseRequests->find($id); 
    return (undef, "Demande introuvable") unless ($wr);
    
    # Calculer la longueur nécessaire pour les zéros
    my $id_length = length($id);
    my $zeros_needed = 12 - 3 - $id_length;  # 12 total - 3 pour "574" - longueur de $id

    # Construire le code-barres
    my $barcode_text;
    if ($zeros_needed >= 0) {
        $barcode_text = "574" . ("0" x $zeros_needed) . $id;
    } else {
        # Si $id est trop long, on le tronque pour que le total fasse 12
        my $max_id_length = 12 - 3;  # 9 caractères max pour $id
        $barcode_text = "574" . substr($id, -$max_id_length);
    }

    my $barcode_obj = Barcode::Code128->new();
    $barcode_obj->border(0);       
    $barcode_obj->height(120);
    $barcode_obj->width(280);      
    $barcode_obj->scale(2);         
    $barcode_obj->show_text(0);    
    $barcode_obj->padding(2);      

    my $png_data = $barcode_obj->png($barcode_text);
    my $barcode_b64 =encode_base64($png_data);
    my $barcode_html = qq{<img src="data:image/png;base64,$barcode_b64" style="width:100%; height:60px; image-rendering:pixelated;" />};

    my $patron = Koha::Patrons->find($wr->borrowernumber);
    return (undef, "Utilisateur introuvable") unless $patron;

    my $item = Koha::Items->find($wr->itemnumber);
    return (undef, "Exemplaire introuvable") unless $item;

    my $biblio = Koha::Biblios->find($wr->biblionumber);
    return (undef, "Notice introuvable") unless $biblio;

    my $biblioitem = Koha::Biblioitems->find($item->biblioitemnumber);
    return (undef, "Notice biblioitem introuvable") unless $biblioitem;
    
    my $desk; 
    if ($item->itype eq "RESERVE-MG") {
        $desk = "Réserve";
    } else {
        $desk = "RDJ";
    }
    #warn $desk;

    # On ajuste la taille du titre en fonction de sa longueur
    my $title_text   = $biblio->title // '';
    my $title_length = length($title_text);

    my $title_font_size;
    if    ($title_length <= 40)  { $title_font_size = '14pt'; }
    elsif ($title_length <= 80)  { $title_font_size = '11pt'; }
    elsif ($title_length <= 120) { $title_font_size = '9pt';  }
    else                         { $title_font_size = '7pt';  }

    my $vars = {
        barcode             => $barcode_html,  # binaire base64, pas de pb
        barcodenumber       => _to_utf8($barcode_text),
        reservedate         => _to_utf8($wr->created_on),
        notes               => _to_utf8($wr->notes),
        firstname           => _to_utf8($patron->firstname),
        surname             => _to_utf8($patron->surname),
        desk                => _to_utf8($desk),
        itemcallnumber      => _to_utf8($item->itemcallnumber),
        ccode               => _to_utf8($item->ccode),
        itype               => _to_utf8($item->itype),
        volume              => _to_utf8($item->enumchron),
        publicationyear     => _to_utf8($biblioitem->publicationyear),
        title               => _to_utf8($biblio->title),
        title_font_size     => $title_font_size,
        author              => _to_utf8($biblio->author),
        borrowernumber      => $wr->borrowernumber,
        location            => _to_utf8($item->location),
        cardnumber          => _to_utf8($patron->cardnumber),
        notforloan          => $item->notforloan,
        damaged             => $item->damaged,
        itemlost            => $item->itemlost,
    };


    my $tt = Template->new({
        INCLUDE_PATH => $plugin->mbf_path('templates'),
        ENCODING     => 'utf8',
        INTERPOLATE => 1,
    });
    
    my ($html_fh, $html_filename) = tempfile(SUFFIX => '.html', UNLINK => 0);
    binmode($html_fh, ':encoding(UTF-8)');  
    my ($pdf_fh, $pdf_filename)   = tempfile(SUFFIX => '.pdf',  UNLINK => 0);

    my $html_output = '';
    unless ($tt->process('WRMSlip.tt', $vars, \$html_output)) {
        return (undef, "Erreur Template Toolkit:" . $tt->error());
    }

    print $html_fh $html_output;
    close $html_fh;

    my $cmd = "/usr/bin/wkhtmltopdf " .
    "--encoding utf-8 " .
    "--page-width 210mm " .
    "--page-height 148mm " .
    "--margin-top 0 " .
    "--margin-bottom 0 " .
    "--margin-left 0 " .
    "--margin-right 0 " .
    "--zoom 1.0 " .
    "--dpi 300 " .
    "'$html_filename' '$pdf_filename'";

    #warn "CMD: $cmd";
    system($cmd);

    # Lire le PDF
    open my $pdf_fh_read, '<', $pdf_filename or return (undef, "Impossible de lire le PDF");
    binmode $pdf_fh_read;
    my $pdf_binary = do { local $/; <$pdf_fh_read> };
    close $pdf_fh_read;

    # Nettoyage
    unlink $html_filename;
    unlink $pdf_filename;

    return ($pdf_binary, undef);
}

sub _to_utf8 {
    my $str = shift;
    return '' unless defined $str;
    # Si déjà marquée UTF-8 par Perl, on la retourne telle quelle
    if (is_utf8($str)) {
        return $str;
    }
    # Sinon on tente de la décoder depuis l'UTF-8 binaire
    my $decoded = eval { decode('UTF-8', $str, Encode::FB_CROAK) };
    if ($@) {
        # Si ça échoue, on suppose Latin-1
        $decoded = decode('Latin-1', $str);
    }
    return $decoded;
}

1;