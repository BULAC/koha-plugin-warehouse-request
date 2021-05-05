package Koha::WarehouseRequests;

# Copyright ByWater Solutions 2015
#
# This file is part of Koha.
#
# Koha is free software; you can redistribute it and/or modify it under the
# terms of the GNU General Public License as published by the Free Software
# Foundation; either version 3 of the License, or (at your option) any later
# version.
#
# Koha is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with Koha; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

use Modern::Perl;

use Carp;

use Koha::Database;
use Koha::DateUtils qw(dt_from_string);
use Koha::WarehouseRequest;
use Koha::WarehouseRequestStatus;

use base qw(Koha::Objects);

=head1 NAME

Koha::WarehouseRequests - Koha WarehouseRequests Object class

=head1 API

=head2 Class Methods

=cut

=head3 pending

=cut

sub pending {
    my ( $self, $branchcode, $desk_id ) = @_;
    my $params = { status => Koha::WarehouseRequestStatus::Pending, archived => 0 };
    $params->{branchcode} = $branchcode if $branchcode;
    $params->{desk_id} = $desk_id if $desk_id;
    return Koha::WarehouseRequests->search( $params );
}

=head3 processing

=cut

sub processing {
    my ( $self, $branchcode, $desk_id ) = @_;
    my $params = { status => Koha::WarehouseRequestStatus::Processing, archived => 0 };
    $params->{branchcode} = $branchcode if $branchcode;
    $params->{desk_id} = $desk_id if $desk_id;
    return Koha::WarehouseRequests->search( $params );
}

=head3 waiting

=cut

sub waiting {
    my ( $self, $branchcode, $desk_id ) = @_;
    my $params = { status => Koha::WarehouseRequestStatus::Waiting, archived => 0 };
    $params->{branchcode} = $branchcode if $branchcode;
    $params->{desk_id} = $desk_id if $desk_id;
    return Koha::WarehouseRequests->search( $params );
}

=head3 completed

=cut

sub completed {
    my ( $self, $branchcode, $desk_id ) = @_;
    my $params = { status => Koha::WarehouseRequestStatus::Completed, archived => 0 };
    $params->{branchcode} = $branchcode if $branchcode;
    $params->{desk_id} = $desk_id if $desk_id;
    return Koha::WarehouseRequests->search( $params );
}

=head3 canceled

=cut

sub canceled {
    my ( $self, $branchcode, $desk_id ) = @_;
    my $params = { status => Koha::WarehouseRequestStatus::Canceled, archived => 0 };
    $params->{branchcode} = $branchcode if $branchcode;
    $params->{desk_id} = $desk_id if $desk_id;
    return Koha::WarehouseRequests->search( $params );
}

=head3 toarchive

=cut

sub to_archive {
    my ( $self, $older_than ) = @_;
    my $date = dt_from_string();
    $date->subtract( days => $older_than );
    my $dtf = Koha::Database->new->schema->storage->datetime_parser;
    return Koha::WarehouseRequests->search({
        archived => 0,
        updated_on => { '<=' => $dtf->format_date($date) },
        -or => [
            { status => Koha::WarehouseRequestStatus::Completed },
            { status => Koha::WarehouseRequestStatus::Canceled }
        ]
    });
}

=head3 archived_since

=cut

sub archived_since {
    my ( $self, $since ) = @_;
    my $date = dt_from_string();
    $date->subtract( days => $since );
    my $dtf = Koha::Database->new->schema->storage->datetime_parser;
    return Koha::WarehouseRequests->search({
        archived => 1,
        updated_on => { '<=' => $dtf->format_date($date) }
    });
}

=head3 _type

=cut

sub _type {
    return 'WarehouseRequest';
}

sub object_class {
    return 'Koha::WarehouseRequest';
}

=head1 AUTHOR

Gwendal Joncour <gwendal.joncour@univ-rennes2.fr>
Julien Sicot <julien.sicot@univ-rennes2.fr>
Kyle M Hall <kyle@bywatersolutions.com>

=cut

1;
