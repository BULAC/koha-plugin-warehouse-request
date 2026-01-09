ALTER TABLE warehouse_requests ADD COLUMN desk_id INT(11) DEFAULT NULL AFTER branchcode,
  ADD KEY desk_id (`desk_id`),
  ADD CONSTRAINT `warehouse_requests_ibfk_5` FOREIGN KEY (`desk_id`) REFERENCES `desks` (`desk_id`) ON DELETE SET NULL ON UPDATE CASCADE ;
  
